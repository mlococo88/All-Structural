// Steel Bridge Design: legal-load and permit rating (2026-11-23; apps/steel-bridge/engine/rating.js "legal-load and permit rating",
// ui/rating.js buildVeh, engine/analysis.js R.vehicle). Made-up bridges: this app's built-in section on a 100 ft simple span and on its own
// three continuous spans.
//  1. factor tables: γ_LL of legal loads by ADTT (MBE 4th Ed. Tables 6A.4.4.2.3a-1 / -3b-1), of permits (Table 6A.4.5.4.2a-1), posting (Eq. 6A.8.3-1),
//     the axle-train parser;
//  2. every vehicle of shared/vehicles.js offered here: its per-lane simple-span moment at every station and its end reaction against a hand
//     method (an axle at the section, both directions: Σ P·(influence ordinate)), IM 0 and IM 33 %;
//  3. hand check, 100 ft simple span, Type 3: M at midspan by axle positions, IM, DF, γ_LL, RF and tons; one shear RF; a permit (special, one lane);
//  4. identity: with no vehicle ticked build() returns no veh field and the same rows as without the option; the analysis result is unchanged by a
//     vehicle run; the lane-type model's mask; the owner targets; the Summary column only with vehicles.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const U = loadShared('units.js', 'steps.js', 'vehicles.js', 'moving-load.js', E('engine/model.js'), E('engine/sections.js'), E('engine/flexure.js'), E('engine/owners.js'), 'lldf.js', E('engine/lldf.js'), E('engine/loads.js'),
  E('engine/shear.js'), E('engine/stiffeners.js'), E('engine/analysis.js'), E('engine/fatigue.js'), E('engine/rating.js'), E('engine/framing.js'), E('ui/shear.js'), E('ui/flexure.js'), E('ui/rating.js'));
const RT = U.SBDRating, RU = U.SBDRatingUI, M = U.SBDModel, PRE = U.SharedVehicles.build().presets;
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);
const simple = () => { const P = M.defaultProject(); P.spans = { lengths: [100], continuity: 'simple' }; P.xs = M.defaultXs(P); P.girders.forEach(g => { g.segments = [{ ...g.segments[0], x0: 0, x1: 100 }]; }); P.rating = { phiC: 1, phiS: 1 }; return P; };
const KEYS = [...RT.VEH_GROUPS.flatMap(g => g.keys), 'CT-TLC'];

test('factor tables: legal γ_LL by ADTT, permit γ_LL, posting, GVW/AL, the axle-train parser', () => {
  // Tables 6A.4.4.2.3a-1 / -3b-1: 1.30 at ADTT ≤ 1000, 1.45 at ≥ 5000 and unknown, linear between: ADTT 2000 → 1.30 + 0.15(1000/4000) = 1.3375
  assert.equal(RT.gammaLegal(100), 1.30); assert.equal(RT.gammaLegal(1000), 1.30); assert.equal(RT.gammaLegal(5000), 1.45); assert.equal(RT.gammaLegal(9000), 1.45); assert.equal(RT.gammaLegal(null), 1.45); assert.equal(RT.gammaLegal(''), 1.45);
  near(RT.gammaLegal(2000), 1.3375, 1e-12, 'ADTT 2000'); near(RT.gammaLegal(3000), 1.375, 1e-12, 'ADTT 3000');
  // Table 6A.4.5.4.2a-1, routine: rows ADTT ≥ 5000 / 1000 / ≤ 100, columns GVW/AL ≤ 2.0 / 2.0–3.0 / ≥ 3.0
  [[5000, 1.5, 1.40], [5000, 2.5, 1.35], [5000, 3.2, 1.30], [1000, 1.5, 1.35], [1000, 2.5, 1.25], [1000, 3.0, 1.20], [100, 2.0, 1.30], [100, 2.9, 1.20], [50, 4, 1.15], [null, 2.5, 1.35], [8000, null, 1.40]]
    .forEach(([a, w, g]) => near(RT.gammaPermit('routine', a, w).g, g, 1e-12, `routine ADTT ${a} GVW/AL ${w}`));
  near(RT.gammaPermit('routine', 3000, 2.5).g, 1.30, 1e-12, 'routine, ADTT 3000, middle column: 1.25 + 0.10(2000/4000)'); near(RT.gammaPermit('routine', 550, 3.5).g, 1.175, 1e-12, 'routine, ADTT 550: 1.15 + 0.05(450/900)');
  assert.equal(RT.gammaPermit('routine', 2000, 2).df, 'multi');
  [['multi', 1.40], ['trip-mixed', 1.20], ['trip-escort', 1.10]].forEach(([t, g]) => { const q = RT.gammaPermit(t, 2000, 2.5); assert.equal(q.g, g); assert.equal(q.df, 'one'); assert.equal(q.verified, false); });
  // posting, Eq. 6A.8.3-1: W = 25 tons, RF 0.80 → 25/0.7(0.80 − 0.30) = 17.857 tons
  near(RT.posting(25, 0.8).P, 17.857142857, 1e-8, 'posting'); assert.equal(RT.posting(25, 1.0).st, 'ok'); assert.equal(RT.posting(25, 0.3).st, 'close'); assert.equal(RT.posting(25, 0.31).st, 'post');
  // CT-TLC: GVW 279.6 kip over 84.78 ft = 3.298 kip/ft
  const w = RT.weightRatio(PRE['CT-TLC'].axles); near(w.gvw, 279.6, 1e-9, 'GVW'); near(w.AL, 84.78, 1e-9, 'AL'); near(w.wr, 3.29795, 1e-4, 'GVW/AL');
  assert.deepEqual(JSON.parse(JSON.stringify(RT.parseAxles('12, 20@12; 20@4.5').axles)), [[12, 0], [20, 12], [20, 4.5]]); assert.ok(RT.parseAxles('12, x').err); assert.ok(RT.parseAxles('').err); assert.ok(RT.parseAxles('12, 20').err);
  // the gross weights of the offered vehicles (kip)
  const W = { Type3: 50, Type3S2: 72, 'Type3-3': 80, 'Legal-Lane': 60, SU4: 54, SU5: 62, SU6: 69.5, SU7: 77.5, EV2: 57.5, EV3: 86, 'H20-Legal': 40, RIPTA: 41.6, 'CT-TLC': 279.6 };
  KEYS.forEach(k => near(PRE[k].axles.reduce((a, q) => a + q[0], 0), W[k], 1e-9, k));
});

/* hand method: the largest simple-span moment at section a (span L) of an axle train: an axle at the section, the train heading either way */
const offs = ax => { let s = 0; return ax.map(q => (s += q[1])); };
const il = (a, L, x) => (x < 0 || x > L ? 0 : x <= a ? x * (L - a) / L : a * (L - x) / L);
function handM(ax, a, L) { const o = offs(ax); let best = 0; o.forEach(ok => [1, -1].forEach(d => { const m = ax.reduce((t, q, j) => t + q[0] * il(a, L, a + d * (o[j] - ok)), 0); best = Math.max(best, m); })); return best; }
/* the largest end reaction: an axle at the support, the rest on the span */
function handR(ax, L) { const o = offs(ax); let best = 0; o.forEach(ok => [1, -1].forEach(d => { const r = ax.reduce((t, q, j) => { const x = d * (o[j] - ok); return t + (x < 0 || x > L ? 0 : q[0] * (L - x) / L); }, 0); best = Math.max(best, r); })); return best; }

const PS = simple(), AS = RU.fromAnalysis(PS, 0);
test('each vehicle on a 100 ft simple span: per-lane moment at every station and the end shear = the hand method (an axle at the section)', () => {
  assert.ok(!AS.err, AS.err); const R = AS.R, X = R.x; assert.equal(typeof R.vehicle, 'function'); assert.ok(!Object.keys(R).includes('vehicle'), 'R.vehicle is not an enumerable result');
  let n = 0;
  KEYS.forEach(k => { const p = PRE[k], ax = k === 'Legal-Lane' ? p.axles : p.axles, lane = p.udl.mode === 'lane' ? p.udl.w : 0;
    const r0 = R.vehicle({ short: k, axles: p.axles, udl: p.udl, neglect: p.neglect, multi: p.multi, im: 0 }), r33 = R.vehicle({ short: k, axles: p.axles, udl: p.udl, neglect: p.neglect, multi: p.multi, im: 33 });
    X.forEach((x, i) => { const h = handM(ax, x, 100) + lane * x * (100 - x) / 2; near(r0.perLane.Mmax[i], h, 1e-6 * Math.max(1, h), `${k} M at ${x}`); near(r33.perLane.Mmax[i], 1.33 * handM(ax, x, 100) + lane * x * (100 - x) / 2, 1e-6 * Math.max(1, h), `${k} M+IM at ${x}`); assert.ok(Math.abs(r0.perLane.Mmin[i]) < 1e-9); n++; });
    near(r0.perLane.VRmax[0], handR(ax, 100) + lane * 50, 1e-6 * 100, `${k} end shear`); n++;
    assert.equal(R.vehicle({ short: k, axles: p.axles, udl: p.udl, neglect: p.neglect, multi: p.multi, im: 33 }), r33, 'one run per vehicle (kept with the analysis)'); });
  // Type 3 (16, 17, 17 kip at 0, 15, 19 ft), midspan of 100 ft: the middle axle at 50, the front at 35, the rear at 54: 16(17.5) + 17(25) + 17(23) = 280 + 425 + 391 = 1,096.0 kip-ft
  near(handM(PRE.Type3.axles, 50, 100), 1096, 1e-9, 'Type 3 at midspan by hand');
  // end reaction: the rear axle at the support, 17 + 17(96/100) + 16(81/100) = 17 + 16.32 + 12.96 = 46.28 kip
  near(handR(PRE.Type3.axles, 100), 46.28, 1e-9, 'Type 3 end reaction by hand');
  console.log(`       ${KEYS.length} vehicles, ${n} per-lane values equal the hand method`);
});

test('hand check, 100 ft simple span, interior girder: Type 3 flexure RF and tons, a shear RF, a special permit (one-lane factor)', () => {
  const P = simple(); P.rating.veh = { on: ['Type3'], permit: { key: 'Type3S2', type: 'trip-escort' } };
  const B = RU.build({ P, g: 0, src: 'analysis', veh: true }); assert.ok(!B.err, B.err);
  const R = RU.fromAnalysis(P, 0).R, v = B.veh.list[0], pm = B.veh.list[1], i50 = R.x.findIndex(x => Math.abs(x - 50) < 1e-9);
  assert.equal(v.key, 'Type3'); near(v.gam, 1.3375, 1e-12, 'γ_LL at the default ADTT 2000'); assert.equal(v.im, 33); assert.equal(v.df, 'multi'); assert.equal(v.tons, 25);
  // midspan: M_lane = 1.33(1,096.0) = 1,457.68 kip-ft; per girder g_M × M_lane
  const gM = R.ll.gM[i50], Mg = gM * 1.33 * 1096; near(v.VL.ll.Mpos[i50], Mg, 1e-6 * Mg, 'M_LL+IM per girder at midspan');
  const q = v.rows.find(r => r.kind === 'flex' && r.key === 'mp' && Math.abs(r.x - 50) < 1e-9); assert.ok(q, 'compact positive section at midspan (moment basis)');
  near(q.LL, Mg, 1e-6 * Mg, 'row LL'); const rf = (q.C - 1.25 * q.DC - 1.50 * q.DW - (q.F || 0)) / (1.3375 * Mg); near(q.inv, rf, 1e-5, 'RF = (C − 1.25DC − 1.50DW)/(γ_LL M_LL+IM)'); assert.equal(q.opr, q.inv); assert.equal(q.lim, 'Strength I');
  const ids = q.steps.map(s => s.id); ['rt.LLv', 'rt.LL', 'rt.gLL', 'rt.inv'].forEach(id => assert.ok(ids.includes(id), id)); assert.ok(!ids.includes('rt.opr'));
  near(v.rated, v.rf * 25, 1e-9, 'RT = RF × W'); assert.equal(v.posting.st, v.rf >= 1 ? 'ok' : 'post');
  // shear at the left bearing: V_lane = 1.33(46.28) = 61.552 kip; per girder g_V × V_lane
  const s0 = v.rows.filter(r => r.kind === 'shear').sort((a, b) => a.x - b.x)[0], gV = R.ll.gVR[0], Vg = gV * 1.33 * 46.28; near(s0.LL, Vg, 1e-6 * Vg, 'V_LL+IM at the bearing');
  near(s0.inv, (s0.C - 1.25 * s0.DC - 1.50 * s0.DW) / (1.3375 * Vg), 1e-5, 'shear RF'); assert.ok(s0.steps.some(t => t.id === 'rt.LLv' && Math.abs(t.value - Vg) < 1e-4));
  // Service II: γ_LL 1.30 for a legal load
  const sv = v.rows.find(r => r.kind === 'svc' && r.key === 'svb' && Math.abs(r.x - 50) < 1e-9); near(sv.inv, (sv.C - sv.DC - sv.DW - (sv.F || 0)) / (1.30 * sv.LL), 1e-9, 'Service II RF');
  // permit, single trip escorted: Strength II, γ_LL 1.10, the one-lane factor without m (the fatigue factor), Service II γ_LL 1.00
  assert.equal(pm.cat, 'permit'); assert.equal(pm.lim, 'Strength II'); assert.equal(pm.gam, 1.10); assert.equal(pm.df, 'one'); assert.equal(pm.verified, false);
  const hp = handM(PRE.Type3S2.axles, 50, 100), Mp = R.fat.gM[i50] * 1.33 * hp, qp = pm.rows.find(r => r.kind === 'flex' && r.key === 'mp' && Math.abs(r.x - 50) < 1e-9);
  near(qp.LL, Mp, 1e-6 * Mp, 'permit M per girder'); near(qp.inv, (qp.C - 1.25 * qp.DC - 1.50 * qp.DW - (qp.F || 0)) / (1.10 * Mp), 1e-5, 'permit RF'); assert.equal(qp.lim, 'Strength II');
  const svp = pm.rows.find(r => r.kind === 'svc' && r.key === 'svb' && Math.abs(r.x - 50) < 1e-9); near(svp.inv, (svp.C - svp.DC - svp.DW - (svp.F || 0)) / (1.00 * svp.LL), 1e-9, 'permit Service II RF');
  assert.ok(R.fat.gM[i50] < R.ll.gM[i50], 'one lane without m is below the design factor');
  console.log(`       Type 3, x = 50 ft: g_M = ${gM.toFixed(4)}, M_LL+IM = ${gM.toFixed(4)}(1.33)(1,096.0) = ${Mg.toFixed(1)} kip-ft, C = ${q.C.toFixed(1)}, DC = ${q.DC.toFixed(1)}, DW = ${q.DW.toFixed(1)}, F = ${(q.F || 0).toFixed(1)}: RF = ${q.inv.toFixed(3)}; governing ${v.rf.toFixed(3)} (${v.gov.title}, ${v.gov.name}), RT = ${v.rated.toFixed(1)} tons`);
  console.log(`       shear, ${s0.name}: g_V = ${gV.toFixed(4)}, V_LL+IM = ${Vg.toFixed(2)} kip, C = ${s0.C.toFixed(1)}, DC = ${s0.DC.toFixed(1)}, DW = ${s0.DW.toFixed(1)}: RF = ${s0.inv.toFixed(3)}`);
  console.log(`       permit Type 3S2 (escorted single trip): M_lane = 1.33(${hp.toFixed(1)}), g_1/1.2 = ${R.fat.gM[i50].toFixed(4)}, M = ${Mp.toFixed(1)} kip-ft: RF = ${qp.inv.toFixed(3)}; governing ${pm.rf.toFixed(3)}, RT = ${pm.rated.toFixed(1)} tons`);
});

test('nothing ticked: the same results as before; the vehicles do not change the HL-93 rating or the analysis; lane-type model mask; owner targets', () => {
  const P = simple(), key = B => JSON.stringify(B.rows.map(q => [q.name, q.key, q.kind, q.C, q.DC, q.DW, q.LL, q.inv, q.opr, q.oos ? 0 : q.steps.map(s => [s.id, s.label, s.eq, s.sub, s.value, s.ref, s.note])]));
  const B0 = RU.build({ P, g: 0, src: 'analysis' }), k0 = key(B0), a0 = JSON.stringify(RU.fromAnalysis(P, 0).R);
  const B1 = RU.build({ P, g: 0, src: 'analysis', veh: true }); assert.ok(!('veh' in B1)); assert.equal(key(B1), k0);
  P.rating.veh = { on: [], permit: { key: '' } }; const B2 = RU.build({ P, g: 0, src: 'analysis', veh: true }); assert.ok(!('veh' in B2)); assert.equal(key(B2), k0);
  P.rating.veh = { on: ['SU4', 'Legal-Lane', 'EV2'], evG: 'fhwa' };
  const B3 = RU.build({ P, g: 0, src: 'analysis' }); assert.ok(!('veh' in B3), 'not asked (Auto design): no vehicles'); assert.equal(key(B3), k0);
  const B4 = RU.build({ P, g: 0, src: 'analysis', veh: true }); assert.equal(key(B4), k0, 'the HL-93 rows are unchanged by the vehicles'); assert.equal(B4.veh.list.length, 3);
  const A4 = RU.fromAnalysis(P, 0).R; assert.equal(JSON.stringify({ ...A4, settings: undefined }), JSON.stringify({ ...JSON.parse(a0) && RU.fromAnalysis(simple(), 0).R, settings: undefined }), 'the analysis result is unchanged');
  const lane = B4.veh.list.find(v => v.cat === 'lane'); assert.ok(lane.na && !lane.rows, 'lane-type model: not applicable to a 100 ft simple span');
  const ev = B4.veh.list.find(v => v.key === 'EV2'); assert.equal(ev.gam, 1.30); assert.equal(ev.posting, null);
  assert.equal(B4.veh.list.find(v => v.key === 'SU4').post, true);
  // continuous: the lane-type model rates negative moment and the pier-region shear only (spans ≤ 200 ft)
  const C = M.defaultProject(); C.rating = { phiC: 1, phiS: 1, veh: { on: ['Type3-3', 'Legal-Lane'] } }; C.ownerRules = { ...(C.ownerRules || {}), owner: 'CTDOT' };
  const R = RU.fromAnalysis(C, 0).R, p = PRE['Legal-Lane'], run = R.vehicle({ short: 'L', axles: p.axles, udl: p.udl, neglect: p.neglect, multi: p.multi, im: 33 }), VL = RT.vehicleLL(R, run, { cat: 'lane', df: 'multi' });
  assert.ok(VL.applies && VL.over200.length === 0); assert.ok(VL.ll.Mpos.every(v => v === 0)); assert.ok(VL.ll.Mneg.some(v => v < -100));
  R.x.forEach((x, i) => { if (!(R.region[i] >= 1)) assert.equal(VL.ll.VRpos[i], 0); }); assert.ok(R.x.some((x, i) => R.region[i] >= 1 && VL.ll.VRpos[i] > 0));
  const one = R.vehicle({ short: 'T', axles: PRE['Type3-3'].axles, udl: PRE['Type3-3'].udl, neglect: true, multi: PRE['Type3-3'].multi, im: 33 });
  assert.ok(Math.min(...run.perLane.Mmin) < Math.min(...one.perLane.Mmin), 'two 75 % trucks + 0.2 klf give more negative moment at the pier than one Type 3-3');
  // a permit vehicle on the continuous girder: the 0.2 klf lane load on top for negative moment only (spans ≤ 200 ft); by hand at pier 1: the lane-load part is
  // 0.2 klf × (the negative area of the influence line) = the difference of the two runs, and it carries no IM (the same difference at IM 0 and 33 %)
  const ct = PRE['CT-TLC'], pr = im => R.vehicle({ short: 'P', axles: ct.axles, udl: { mode: 'none', w: 0, gap: 0, trunc: false }, neglect: ct.neglect, multi: { on: false }, im }), prL = im => R.vehicle({ short: 'P+', axles: ct.axles, udl: { mode: 'lane', w: 0.2, gap: 0, trunc: false }, neglect: ct.neglect, multi: { on: false }, im });
  const VP = RT.vehicleLL(R, pr(0), { cat: 'permit', df: 'multi' }, prL(0)), ip = R.supIdx[1];
  assert.ok(VP.withLane.Mmin[ip] && !VP.withLane.Mmax[ip] && !VP.withLane.VRmax[ip]); assert.equal(VP.per.Mmax[ip - 30], pr(0).perLane.Mmax[ip - 30]); assert.ok(VP.per.Mmin[ip] < pr(0).perLane.Mmin[ip] - 100);
  near(prL(33).perLane.Mmin[ip] - pr(33).perLane.Mmin[ip], prL(0).perLane.Mmin[ip] - pr(0).perLane.Mmin[ip], 1e-6, 'the lane load carries no IM');
  assert.equal(RT.laneModelNeeded([100], false), false); assert.equal(RT.laneModelNeeded([201], false), true); assert.equal(RT.laneModelNeeded([100, 100], true), true); assert.equal(RT.laneModelNeeded([100, 100], false), false);
  // owner targets (reported): RIDOT 1.10 every vehicle; CTDOT 1.20, CT-TLC 1.10; AASHTO and MassDOT none
  assert.equal(RT.vehTarget('RIDOT', 'Type3').need, 1.10); assert.equal(RT.vehTarget('CTDOT', 'EV3').need, 1.20); assert.equal(RT.vehTarget('CTDOT', 'CT-TLC').need, 1.10); assert.equal(RT.vehTarget('AASHTO', 'Type3'), null); assert.equal(RT.vehTarget('MassDOT', 'Type3'), null);
});
