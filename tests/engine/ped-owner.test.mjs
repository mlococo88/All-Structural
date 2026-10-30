// Pedestrian load in this app's analysis and the owner load rules η, m in every module (sb-ped-owner PR, 2026-10-30).
//
// 1. Single count: the built-in project with a 6-ft left sidewalk carrying 75 psf (3.6.1.6) and RIDOT owner rules (m = 1.2). The
//    analysis gives R.pl (the pedestrian envelopes) apart from R.ll (HL-93); every module that takes the analysis receives
//    LL+IM + PL exactly once, and the fatigue, deck placement and LL deflection inputs none:
//      flexure and rating (ui/rating.js fromAnalysis), shear and bearing reactions (ui/shear.js fromAnalysis), splices
//      (engine/splices.js arraysFromAnalysis / demandsAt), flange-to-web welds (ui/welds.js input), fatigue and studs (ui/fatigue.js
//      fromAnalysis: M_FAT, V_FAT only), constructibility and cross-frames (analyzeGirder with ll: false: no live load at all),
//      LL deflection (R.lld: HL-93 only).
// 2. Owner η and m (OWN6/OWN7) with m kept off the pedestrian part (GD45), in the Flexure, Shear, transverse and bearing stiffener,
//    splice and weld demands: the factored values against hand arithmetic.
// 3. Hand check (xsA-like numbers, written out below): one pier location, M_u before and after.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const W = loadShared(...['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/welds.js', 'engine/rating.js', 'ui/flexure.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/rating.js', 'ui/welds.js'].map(E)));
const close = (a, b, what, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);

function proj(owner) {
  const P = W.SBDModel.defaultProject();
  P.xs.sidewalks.L = { w: 6, t: 8, fence: null, fenceX: null }; P.xs.sidewalks.ped = 75;
  P.ownerRules = { owner, eta: { D: 'no', R: 'auto', I: 'no', eD: 1, eR: 1, eI: 1 } };
  return P;
}
let cache = null;
const run = () => cache || (cache = (() => { const P = proj('RIDOT'), AN = W.SBDAnalysis, R = AN.analyzeGirder(P, 0); assert.deepEqual([...R.errors], []); return { P, R, Q: AN.llPL(R) }; })());

test('analysis: the pedestrian load on this girder, apart from HL-93; LL deflection and fatigue without it', () => {
  const { P, R } = run();
  assert.ok(R.pl && R.pl.w > 0, 'w_PL > 0 on the exterior girder under the sidewalk');
  assert.ok(R.pl.Mpos.some(v => v > 0) && R.pl.Mneg.some(v => v < 0));
  assert.ok(!R.warnings.some(w => /Pedestrian load .* not in this analysis/.test(w)), 'the old warning is gone');
  // LL deflection: HL-93 only (2.5.2.6.2; GirderDetail SA3)
  const R0 = W.SBDAnalysis.analyzeGirder({ ...P, xs: { ...P.xs, sidewalks: { ...P.xs.sidewalks, ped: 0 } } }, 0);
  R.lld.forEach((q, k) => close(q.perLane, R0.lld[k].perLane, `LL deflection span ${k + 1}`));
  // R.ll and R.fat do not depend on the pedestrian load
  close(R.ll.Mneg[R.supIdx[1]], R0.ll.Mneg[R0.supIdx[1]], 'HL-93 pier moment unchanged'); close(R.fat.Mpos[50], R0.fat.Mpos[50], 'fatigue unchanged');
  // worked steps for it
  assert.ok(R.steps.some(s => s.id === 'an.M.PL.p1') && R.steps.some(s => s.id === 'an.M.LLPL.p1') && R.steps.some(s => s.id === 'an.R.PL.0'), 'PL steps');
});

test('single count: each module receives LL+IM + PL once (fatigue, deck placement and LL deflection none)', () => {
  const { P, R, Q } = run(), ip = R.supIdx[1], once = R.ll.Mneg[ip] + R.pl.Mneg[ip];
  close(Q.Mneg[ip], once, 'llPL');
  // flexure and rating input
  const A = W.SBDRatingUI.fromAnalysis(P, 0); assert.equal(A.pl.pedestrianInLL, true);
  const s = A.pl.stations[ip]; close(s.M_LLneg, once, 'rating/flexure M_LL−'); close(s.M_PLneg, R.pl.Mneg[ip], 'M_PL−');
  const F = W.SBDFlexure.fromPayload(A.pl, { lf: { eta: 1, etaN: 1, m: 1 } }), loc = F.locs.find(l => Math.abs(l.x - (R.x[ip] - 0.01)) < 0.02);
  const Mx = F.env.Mn[ip]; close(Mx, once, 'flexure env M_LL− (not M_LL + M_PL again, SB2-R1)');
  assert.ok(loc && loc.pl && loc.pl.LLn, 'the location carries its pedestrian part');
  // noDoublePL (the Rating tab's flexure and shear) keeps LL+IM with PL in it, once
  const nd = W.SBDRating.noDoublePL(A.pl); close(nd.stations[ip].M_LLneg, once, 'noDoublePL'); assert.equal(nd.stations[ip].M_PLneg, undefined);
  // shear and the bearing reactions
  const B = W.SBDShearUI.fromAnalysis(P, 0); assert.equal(B.pl.pedestrianInLL, true);
  B.pl.reactions.forEach((r, k) => close(r.LL, R.llR[k].max + R.pl.R[k].max, `R_LL+IM + R_PL support ${k + 1}`));
  const d = W.SBDShear.demands(B.pl, W.SBDShear.factors()), st = B.pl.stations.find(q => Math.abs(q.x - (R.x[ip] - 0.005)) < 1e-6);
  close(-st.V_LLpos, R.ll.VLneg[ip] + R.pl.VLneg[ip], 'V_LL+ left of pier 1 (hand-off sign)');
  const at = d.at(R.x[ip]), sd = k => Math.max(Math.abs(R.ll[k + 'pos'][ip] + R.pl[k + 'pos'][ip]), Math.abs(R.ll[k + 'neg'][ip] + R.pl[k + 'neg'][ip]));   // both sides of the pier (±0.005 ft)
  close(at.LL, Math.max(sd('VL'), sd('VR')), 'shear demand LL');
  assert.ok(at.plLL > 0, 'shear demand carries its pedestrian part');
  // splices
  const SA = W.SBDSplices.arraysFromAnalysis(R); close(SA.Mn[ip], once, 'splice M_LL−'); close(SA.PMn[ip], R.pl.Mneg[ip], 'splice M_PL−');
  const dm = W.SBDSplices.demandsAt(SA, R.x[ip]).dem; assert.ok(dm.pl && dm.pl.MLLn && Math.abs(dm.pl.MLLn[1] - dm.MLLn) < 1e-9, 'splice dem.pl');
  // welds
  const I = W.SBDWeldsUI.input(P, 0); assert.ok(!I.err, I.err);
  { const row = I.p.fw.find(r => r.name === 'Pier 1, left'); assert.ok(row, 'weld row at pier 1');
    close(row.VLL, Math.max(Math.abs(R.ll.VLpos[ip] + R.pl.VLpos[ip]), Math.abs(R.ll.VLneg[ip] + R.pl.VLneg[ip])), 'weld V_LL'); assert.ok(row.pl && row.pl.VLL[0] > 0, 'weld pedestrian part'); }
  // fatigue and studs: the fatigue truck only
  const Fa = W.SBDFatigueUI.fromAnalysis(P, 0); assert.ok(!Fa.err, Fa.err); const fs_ = Fa.pl.stations[ip];
  close(fs_.M_FATneg, R.fat.Mneg[ip], 'fatigue M_FAT− (no pedestrian load, Table 3.4.1-1 Fatigue I)'); close(fs_.V_FATpos, Math.max(R.fat.VRpos[ip], R.fat.VLpos[ip]), 'fatigue V_FAT');
  // deck placement (constructibility, cross-frames): no live load at all
  const C = W.SBDAnalysis.analyzeGirder(P, 0, { ll: false }); assert.equal(C.ll, null); assert.equal(C.pl, null);
});

test('owner η and m: m on HL-93 LL+IM only, η on the Strength factors, in flexure, shear, stiffeners, bearings, splices and welds', () => {
  const { P, R } = run(), lf = W.SBDOwners.loadFactors('RIDOT', P.ownerRules.eta, P.xs.nb), m = lf.m, eta = lf.eta;
  assert.equal(m, 1.2);
  const ip = R.supIdx[1], LL = R.ll.Mneg[ip], PL = R.pl.Mneg[ip];
  // flexure (the Flexure tab, this project's analysis)
  const FB = W.SBDFlexureUI.build({ P, g: 0, src: 'analysis', fl: 0, method: 'auto' }); assert.ok(!FB.err, FB.err);
  close(FB.prj.G.ll, 1.75 * eta * m, 'γ_LL = 1.75ηm'); close(FB.prj.G.sll, 1.30 * m, 'Service II γ_LL = 1.30m'); close(FB.prj.G.dc, 1.25 * eta, 'γ_DC'); close(FB.prj.G.dcMin, 0.90 * lf.etaN, 'γ_DC min');
  const r = FB.rows.find(q => q.region === 'neg' && Math.abs(q.x - (R.x[ip] - 0.01)) < 0.02); assert.ok(r, 'pier location');
  // used M_LL− = (LL + PL) − PL + PL/m, so that γηm × it = γηm LL + γη PL
  assert.ok(r.plAdj.length && r.plAdj.some(a => a.k === 'LLn'), 'plAdj');
  const a = r.plAdj.find(q => q.k === 'LLn'); close(a.v, a.v0 - a.q + a.q / m, 'M_LL used');
  close(1.75 * eta * m * a.v, 1.75 * eta * m * (a.v0 - a.q) + 1.75 * eta * a.q, 'γηm M_LL + γη M_PL');
  assert.ok(r.steps.some(s => s.id === 'fx.own.ll') && r.steps.some(s => s.id === 'fx.pl.LLn'), 'owner and pedestrian steps');
  // shear (and the transverse and bearing stiffener rows)
  const SB = W.SBDShearUI.build({ P, g: 0, src: 'analysis' }); assert.ok(!SB.err, SB.err);
  close(SB.G.ll, 1.75 * eta * m, 'shear γ_LL');
  const sr = SB.stations.find(q => q.plAdj && q.plAdj.length); assert.ok(sr, 'a shear location with its pedestrian part');
  const sa = sr.plAdj[0]; close(sa.v, sa.v0 - sa.q + sa.q / m, 'shear V_LL used');
  const br = SB.BS.rows.find(q => q.plAdj && q.plAdj.length); assert.ok(br, 'bearing row with R_PL kept off m');
  const ba = br.plAdj[0]; close(ba.v, ba.v0 - ba.q + ba.q / m, 'R_LL used');
  if (SB.TS && SB.TS.rows.length) assert.ok(SB.TS.rows.some(q => q.plAdj && q.plAdj.length), 'transverse stiffener rows');
  // welds (flange-to-web): γ_LL = 1.75ηm and the pedestrian part without m
  const WB = W.SBDWeldsUI.build({ P, g: 0 }); assert.ok(!WB.err, WB.err); close(WB.R.g.ll, 1.75 * eta * m, 'weld γ_LL');
  const wr = WB.R.fw.find(q => q.plAdj && q.plAdj.length); assert.ok(wr, 'weld row with its pedestrian part'); close(wr.plAdj[0].v, wr.plAdj[0].v0 - wr.plAdj[0].q + wr.plAdj[0].q / m, 'weld V_LL used');
  // splices: the demand at a splice carries its pedestrian parts (engine/splices.js compute keeps m off them, plE)
  const SA = W.SBDSplices.arraysFromAnalysis(R), x0 = R.x[Math.round(ip * 0.75)], dm = W.SBDSplices.demandsAt(SA, x0).dem;
  assert.ok(dm.pl && (dm.pl.MLLn || dm.pl.MLLp) && dm.pl.VLL, 'splice dem.pl');
});

/* 3. Hand check, one pier location (numbers of xsA RIDOT G1 pier 1, rounded; the arithmetic of engine/flexure.js location()):
      M_DC1 = −2500, M_DC2 = −300, M_DW = −350, M_LL+IM = −2200 (HL-93), M_PL = −250 kip-ft; RIDOT m = 1.2, η = 1.0.
      Before (no pedestrian load in the analysis, no η, m in flexure):
        M_u = 1.25(−2500) + 1.25(−300) + 1.50(−350) + 1.75(−2200) = −3125 − 375 − 525 − 3850 = −7875.0 kip-ft
      After (PL in LL+IM once; m on HL-93 only):
        M_LL+IM+PL = −2450; used = −2450 − (−250) + (−250)/1.2 = −2200 − 208.333 = −2408.333
        γ_LL = 1.75(1.0)(1.2) = 2.10; M_u = −3125 − 375 − 525 + 2.10(−2408.333) = −4025 − 5057.5 = −9082.5 kip-ft
        (= −4025 + 2.10(−2200) + 1.75(−250) = −4025 − 4620 − 437.5) : +15.33 % */
test('hand check: pier M_u before −7875.0, after −9082.5 kip-ft (pedestrian load once, m on HL-93 only)', () => {
  const FX = W.SBDFlexure, card = { M: { DC1: -2500, DC2: -300, DW: -350, LLp: 0, LLn: -2450, UT: 0, UF: 0, FATp: 0, FATn: 0 } };
  const loc = { name: 'pier', x: 110, region: 'neg', cont: true, plates: { D: 60, tw: 0.5625, topB: 18, topT: 1.25, botB: 20, botT: 2 }, beff: 96, Lb: 20, Cb: 1, fl: 0, ...card, pl: { LLn: [-250, -2450] } };
  const prj = { deck: { composite: true, ts: 8.5, tdeck: 9, haunch: 2, rebar: { top: { A: 8, c: 2.5 }, bot: { A: 4, c: 6 } } }, mat: { Fyt: 50, Fyb: 50, Fyw: 50, Fyr: 60, fc: 4 }, n: 8, rebarInPositive: false, a6: { method: '6108', skews: [0], curved: false } };
  const before = FX.location({ ...loc, M: { ...card.M, LLn: -2200 }, pl: undefined }, { ...prj, G: FX.factors() });
  const after = FX.location(loc, { ...prj, G: FX.factorsOwner({ eta: 1, etaN: 1, m: 1.2 }) });
  close(before.Mu, -7875.0, 'before', 1e-12); close(after.MLLn, -2408.3333333333335, 'used M_LL', 1e-12); close(after.Mu, -9082.5, 'after', 1e-12);
});
