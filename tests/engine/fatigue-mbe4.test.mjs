// apps/steel-bridge/engine/fatigue.js: the remaining fatigue life (FA5, FA6) by the AASHTO MBE 4th Ed. (2026) Section 7 (2026-11-10,
// engineer standing rule). Hand checks on the default project with the Fatigue & studs "Example" demands (GirderDetail's built-in details,
// this project's spans 110, 140, 110 ft and traffic: ADTT 2000, p 0.85, γ_I 1.75, γ_II 0.80) and the evaluation turned on with its defaults
// (opened 1968, evaluated 2026: a = 58; present ADTT_SL 1500; g = 2 %; R_s 1.0; n_L 2; minimum life; 25 years required).
// Detail: "Span 2: lateral gusset welded to web" (Category E, A = 11 × 10⁸ ksi³, (ΔF)_TH = 4.5 ksi, n = 1, x = 180 ft: span 2, L = 140 ft),
// unfactored fatigue-truck range Δf = 2.97021 ksi.
//   R_p = max(0.988 + 6.87e-5(140) + 4.01e-6(1500/0.85 = 1764.71) + 0.0107/2, 1.0) = 0.988 + 0.009618 + 0.007076 + 0.00535 = 1.010044   (Eq. 7.2.2.1-1, p. 7-3)
//   γ_IIΔf = 0.80(2.97021) = 2.37617; (Δf)_eff = R_pR_sγ_IIΔf = 1.010044(1.0)(2.37617) = 2.40004 ksi                                    (Eq. 7.2.2-1, p. 7-2)
//   (Δf)_max = R_pγ_IΔf = 1.010044(1.75)(2.97021) = 5.25008 > 4.5: finite life                                                        (7.2.4, pp. 7-5, 7-6)
//   N_av = R_RA/(Δf)_eff³ = 1.0(11e8)/2.40004³ = 79,568,215                                                                            (Eq. 7.2.5.1-2, p. 7-6)
//   (ADTT_SL)_0 = 1500/1.02^58 = 475.643 (not entered); N_1 = 365(1)(1500)[(1 − 475.643/1500)/((1500/475.643)^(1/58) − 1) + 1]
//       = 547,500[(0.682905)/(0.02) + 1] = 547,500(35.1452) = 19,242,012                                                            (Eq. 7.2.5.1-3, p. 7-7)
//   Y_REM = log[(0.02/1.02)((79,568,215 − 19,242,012)/(365(1)(1500))) + 1]/log(1.02) = log[0.0196078(110.1848) + 1]/log 1.02 = 58.11 yr (Eq. 7.2.5.1-4)
//   58.11 ≥ 25: FA6 passes (ratio 25/58.11 = 0.4302).
// Before (the older method, as GirderDetail): (Δf)_eff = R_sΔf = 2.97021, (Δf)_max = 2(2.97021) = 5.94042 > 4.5;
//   Y = log[1(11e8)(0.02)/(365(1)(1500)(2.97021)³(1.02)^57) + 1]/log 1.02 = 20.34; Y − a = −37.66 years: FA6 failed.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const U = loadShared('units.js', 'steps.js', 'vehicles.js', 'moving-load.js', E('engine/model.js'), E('engine/sections.js'), E('engine/flexure.js'), E('engine/owners.js'), 'lldf.js', E('engine/lldf.js'), E('engine/loads.js'),
  E('engine/shear.js'), E('engine/stiffeners.js'), E('engine/analysis.js'), E('engine/framing.js'), E('engine/crossframes.js'), E('engine/fatigue.js'), E('engine/studs.js'), E('ui/shear.js'), E('ui/flexure.js'), E('ui/fatigue.js'));
const FA = U.SBDFatigue, near = (a, b, t, w) => assert.ok(Math.abs(a - b) <= t, `${w}: ${a} vs ${b}`);
const run = (ev, src) => { const P = U.SBDModel.defaultProject(); if (ev) P.fatigue.ev = { ...JSON.parse(JSON.stringify(FA.EV_DEF)), on: 'yes', ...ev }; const R = U.SBDFatigueUI.build({ P, g: 0, src: src || 'example' }); assert.ok(!R.err, R.err); assert.deepEqual([...R.FR.errors], []); return R; };
const gus = R => { const r = R.FR.rows.find(q => /lateral gusset/.test(q.name)); FA.steps(R.FR, r); return r; };   // the steps built too (tex.test.mjs parses their TeX)

test('MBE 4th Ed. Section 7: hand check, Category E gusset (default project, Example demands, evaluation defaults)', () => {
  const R = run({}), r = gus(R), e = r.ev, lv = e.lives.min;
  near(r.df, 2.97021, 5e-6, 'Δf'); assert.equal(e.L, 140); near(e.Tall, 1764.706, 1e-3, '[ADTT]');
  near(e.Rp, 1.010044, 1e-6, 'R_p'); near(e.dfII, 2.37617, 5e-6, 'γ_IIΔf'); near(e.dfe, 2.40004, 5e-6, '(Δf)_eff'); near(e.dfmax, 5.25008, 5e-6, '(Δf)_max'); assert.equal(e.inf, false);
  near(e.T0, 475.643, 1e-3, '(ADTT_SL)_0'); assert.equal(lv.RR, 1); assert.ok(lv.tab);
  near(lv.Nav, 79568215, 1, 'N_av'); near(lv.N1, 19242012, 1, 'N_1'); near(lv.rem, 58.11, 5e-3, 'Y_REM'); near(lv.Y, 116.11, 5e-3, 'Y');
  const f6 = R.FC.find(c => c.id === 'FA6').items[0]; assert.equal(f6.st, 'pass'); near(f6.r, 25 / 58.10977, 1e-6, 'FA6 ratio');
  const f5 = R.FC.find(c => c.id === 'FA5').items.find(it => /gusset/.test(it.loc)); near(f5.r, 5.25008 / 4.5, 1e-5, 'FA5 ratio'); assert.equal(f5.st, 'warn');
  const ids = FA.steps(R.FR, r).map(s => s.id.replace(/^fa\d+\./, '')); ['Rp', 'dfII', 'dfe', 'dfmax', 'inf', 'RR', 'Nav', 'T0', 'N1', 'Nck', 'Yrem0', 'life'].forEach(k => assert.ok(ids.includes(k), k));
  // Table 7.2.5.1-1, Category E: Evaluation 1 1.2, Evaluation 2 1.4, mean 1.6
  assert.equal(e.lives.E1.RR, 1.2); assert.equal(e.lives.E2.RR, 1.4); assert.equal(e.lives.mean.RR, 1.6);
});
test('MBE 4th Ed. Section 7: WIM truck weights, the ADTT_SL limit, g = 0, entered R_p and first-year ADTT', () => {
  // WIM, R_s = 0.95: (Δf)_eff = 1.010044(0.95)(2.37617) = 2.28003; (Δf)_max = 2.2(1.010044)(1.0)(2.37617) = 5.28008; Y_REM = 65.17
  let e = gus(run({ wim: 'yes', Rs: 0.95 })).ev; near(e.dfe, 2.28003, 5e-6, 'WIM (Δf)_eff'); near(e.dfmax, 5.28008, 5e-6, 'WIM (Δf)_max'); near(e.lives.min.rem, 65.167, 1e-3, 'WIM Y_REM');
  // (ADTT_SL)_LIMIT = 3000: (ADTT_SL)_FUTURE = 1500(1.02)^58.11 = 4,741 > 3000; (Y_ADTT)_LIMIT = log 2/log 1.02 = 35.003;
  // Y_REM = 60,326,204/(365(3000)) − (1.02^35.003 − 1)/(0.02(1.02)^34.003) + 35.003 = 64.60 (Eq. 7.2.5.1-8)
  e = gus(run({ ADTTlim: '3000' })).ev; assert.ok(e.lives.min.limited); near(e.lives.min.fut, 4740.73, 0.01, 'future ADTT'); near(e.lives.min.YL, 35.0028, 1e-4, 'Y_ADTT,LIMIT'); near(e.lives.min.rem, 64.595, 1e-3, 'Y_REM limited');
  // g = 0 (first year = present): N_1 = 365(1)(58 + 1)(1500) = 32,302,500; Y_REM = (79,568,215 − 32,302,500)/(365(1500)) = 86.33
  e = gus(run({ g: 0 })).ev; near(e.lives.min.N1, 32302500, 1e-6, 'N_1, g = 0'); near(e.lives.min.rem, 86.330, 1e-3, 'Y_REM, g = 0');
  // entered: R_p 1.05 (Eq. would give 1.0100), first-year ADTT_SL 1500 = present: N_1 by the first form of Eq. 7.2.5.1-3
  e = gus(run({ Rp: '1.05', ADTT0: '1500' })).ev; assert.equal(e.Rp, 1.05); near(e.RpC, 1.010044, 1e-6, 'R_p eq'); near(e.lives.min.N1, 32302500, 1e-6, 'N_1 equal ADTT');
});
test('MBE 4th Ed. Section 7: saved projects without an evaluation are unchanged; the default project with the evaluation on', () => {
  const off = run(null, 'analysis'), P = U.SBDModel.defaultProject();
  assert.equal(P.fatigue.ev, undefined); assert.equal(off.FR.ev.on, false); assert.ok(!off.FC.some(c => c.id === 'FA5' || c.id === 'FA6'));
  P.fatigue.ev = { ...FA.EV_DEF, on: 'no' }; const off2 = U.SBDFatigueUI.build({ P, g: 0, src: 'analysis' });   // turned off: as before
  assert.equal(JSON.stringify(off2.FC.map(c => c.items.map(i => [i.r, i.st]))), JSON.stringify(off.FC.map(c => c.items.map(i => [i.r, i.st]))));
  // on (defaults), analysis demands: every detail infinite life; Span 3 connection plate (C′, Δf = 4.83921, L = 110 ft):
  // R_p = 0.988 + 0.007557 + 0.007076 + 0.00535 = 1.007983; (Δf)_max = 1.007983(1.75)(4.83921) = 8.53623 ≤ 12 (ratio 0.7114; before 2(4.83921) = 9.67843, 0.8065)
  const on = run({}, 'analysis'), r = on.FR.rows.find(q => /Span 3, connection plate/.test(q.name));
  near(r.ev.Rp, 1.007983, 1e-6, 'R_p span 3'); near(r.ev.dfmax, 8.53623, 5e-5, '(Δf)_max'); assert.ok(on.FR.rows.every(q => q.ev.inf));
  // a GirderDetail-shaped evaluation (no 4th Ed. fields): defaults; without spans or L, R_p needs L
  const fa = JSON.parse(JSON.stringify(FA.DEFAULT)); fa.ev = { ...fa.ev, on: 'yes' };
  assert.match(FA.compute(fa).errors.join(' '), /needs the span length L/); fa.ev.L = 140; assert.deepEqual([...FA.compute(fa).errors], []);
  // model: optional fields validated only when on
  const V = U.SBDModel.validate; P.fatigue.ev = { ...FA.EV_DEF, on: 'yes' }; assert.equal(V(P).errors.length, 0);
  P.fatigue.ev.Rp = 'x'; assert.ok(V(P).errors.some(q => q.path === 'fatigue.ev.Rp')); P.fatigue.ev.on = 'no'; assert.equal(V(P).errors.length, 0);
});
