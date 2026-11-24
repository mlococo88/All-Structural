// Steel Bridge Design: legal-load and permit rating (2026-11-23; apps/steel-bridge/engine/rating.js "legal-load and permit rating",
// ui/rating.js buildVeh, engine/analysis.js R.vehicle). Made-up bridges: this app's built-in section on a 100 ft simple span and on its own
// three continuous spans.
//  1. factor tables: γ_LL of legal loads by ADTT (MBE 4th Ed. Tables 6A.4.4.2.3a-1 / -3b-1), of permits (Table 6A.4.5.4.2a-1), posting (Eq. 6A.8.3-1),
//     the axle-train parser;
//  2. every vehicle of shared/vehicles.js offered here: its per-lane simple-span moment at every station and its end reaction against a hand
//     method (an axle at the section, both directions: Σ P·(influence ordinate)), IM 0 and IM 33 %;
//  3. hand check, 100 ft simple span, Type 3: M at midspan by axle positions, IM, DF, γ_LL, RF and tons; one shear RF; a permit (special, one lane);
//  5. MBE 4th Ed. verification (2026-11-23, MBV): the 0.2 klf lane load with a permit (Art. 6A.4.5.4.1: ADTT above 500, not escorted, the pier-region
//     shear), Service II of a mixed-traffic special permit with the design factor (C6A.6.4.2.2), the lane-type model's W = 80 kip (6A.4.4.4, 6A.8.3).
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
  [['multi', 1.40], ['trip-mixed', 1.20], ['trip-escort', 1.10]].forEach(([t, g]) => { const q = RT.gammaPermit(t, 2000, 2.5); assert.equal(q.g, g); assert.equal(q.df, 'one'); assert.equal(q.verified, true); });   // read against MBE 4th Ed. Table 6A.4.5.4.2a-1 (2026-11-23)
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
  assert.equal(pm.cat, 'permit'); assert.equal(pm.lim, 'Strength II'); assert.equal(pm.gam, 1.10); assert.equal(pm.df, 'one'); assert.equal(pm.dfS, 'one'); assert.equal(pm.verified, true); assert.equal(pm.VLs, null);
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
  assert.ok(VP.withLane.Mmin[ip] && !VP.withLane.Mmax[ip] && VP.withLane.VRmax[ip] && VP.withLane.VLmin[ip], 'pier: negative moment and shear with the lane load (MBE 6A.4.5.4.1)'); const io = R.x.findIndex((x, i) => !(R.region[i] >= 1) && x > 5); assert.ok(io > 0 && !VP.withLane.VRmax[io] && !VP.withLane.VLmin[io] && !VP.withLane.Mmax[io] && VP.withLane.Mmin[io], 'outside the pier region: shear without the lane load'); R.x.forEach((x, i) => assert.equal(VP.withLane.VRmax[i], R.region[i] >= 1, `shear with the lane load only in the pier regions (x = ${x})`)); assert.equal(VP.per.Mmax[ip - 30], pr(0).perLane.Mmax[ip - 30]); assert.ok(VP.per.Mmin[ip] < pr(0).perLane.Mmin[ip] - 100);
  near(prL(33).perLane.Mmin[ip] - pr(33).perLane.Mmin[ip], prL(0).perLane.Mmin[ip] - pr(0).perLane.Mmin[ip], 1e-6, 'the lane load carries no IM');
  assert.equal(RT.laneModelNeeded([100], false), false); assert.equal(RT.laneModelNeeded([201], false), true); assert.equal(RT.laneModelNeeded([100, 100], true), true); assert.equal(RT.laneModelNeeded([100, 100], false), false);
  // owner targets (reported): RIDOT 1.10 every vehicle; CTDOT 1.20, CT-TLC 1.10; AASHTO and MassDOT none
  assert.equal(RT.vehTarget('RIDOT', 'Type3').need, 1.10); assert.equal(RT.vehTarget('CTDOT', 'EV3').need, 1.20); assert.equal(RT.vehTarget('CTDOT', 'CT-TLC').need, 1.10); assert.equal(RT.vehTarget('AASHTO', 'Type3'), null); assert.equal(RT.vehTarget('MassDOT', 'Type3'), null);
});

test('MBE 4th Ed. verification: permit lane load (6A.4.5.4.1), Service II factor of special permits (C6A.6.4.2.2), lane-type W = 80 kip (6A.4.4.4, 6A.8.3)', () => {
  // permitLane: required at ADTT > 500 (or unknown) for continuous girders and spans over 200 ft; not for the escorted permit; not at ADTT ≤ 500
  const pv = (mixed) => ({ cat: 'permit', mixed });
  assert.equal(RT.permitLane(pv(true), 2000, [100, 100], true).on, true); assert.equal(RT.permitLane(pv(true), null, [100, 100], true).on, true); assert.equal(RT.permitLane(pv(true), 501, [250], false).on, true);
  assert.equal(RT.permitLane(pv(true), 500, [100, 100], true).on, false); assert.equal(RT.permitLane(pv(true), 100, [250], false).on, false);
  assert.equal(RT.permitLane(pv(false), 2000, [100, 100], true).on, false, 'escorted: no other vehicle on the bridge'); assert.equal(RT.permitLane(pv(true), 2000, [100], false).on, false, 'simple span of 200 ft or less');
  assert.equal(RT.permitLane({ cat: 'legal' }, 2000, [100, 100], true).on, false); assert.ok(/ADTT 400/.test(RT.permitLane(pv(true), 400, [100, 100], true).why));
  RT.PERMIT_TYPES.forEach(t => { assert.equal(t.dfS, t.id === 'trip-escort' ? 'one' : 'multi'); assert.equal(t.mixed, t.id !== 'trip-escort'); });
  // two equal continuous spans of 100 ft, one plate size: the shear just left of the pier under a uniform load on both spans is (5/8) w L:
  // the 0.2 klf lane load adds 0.625(0.2)(100) = 12.5 kip per lane to the permit vehicle's shear there, with no IM
  const P = M.defaultProject(); P.spans = { lengths: [100, 100], continuity: 'continuous' }; P.xs = M.defaultXs(P); P.girders.forEach(g => { g.segments = [{ ...g.segments[0], x0: 0, x1: 200 }]; }); P.rating = { phiC: 1, phiS: 1, veh: { on: [], permit: { key: 'Type3S2', type: 'routine' } } };
  const A = RU.fromAnalysis(P, 0); assert.ok(!A.err, A.err); const R = A.R, ip = R.supIdx[1], ax = PRE.Type3S2.axles;
  const run = (w, im) => R.vehicle({ short: 'P' + w, axles: ax, udl: w ? { mode: 'lane', w, gap: 0, trunc: false } : { mode: 'none', w: 0, gap: 0, trunc: false }, neglect: true, multi: { on: false }, im });
  const dV = Math.abs(run(0.2, 33).perLane.VLmin[ip]) - Math.abs(run(0, 33).perLane.VLmin[ip]);
  near(dV, 12.5, 0.15, 'lane-load shear at the pier, (5/8)(0.2)(100) kip per lane'); near(Math.abs(run(0.2, 0).perLane.VLmin[ip]) - Math.abs(run(0, 0).perLane.VLmin[ip]), dV, 1e-6, 'no IM on the lane load');
  const B = RU.build({ P, g: 0, src: 'analysis', veh: true }); assert.ok(!B.err, B.err); const v = B.veh.list[0]; assert.ok(v.rows, v.err); assert.equal(v.laneLoad, true); assert.ok(/above 500/.test(v.laneWhy));
  const Vt = Math.abs(run(0, 33).perLane.VLmin[ip]), Vl = Math.abs(run(0.2, 33).perLane.VLmin[ip]); near(Math.abs(v.VL.per.VLmin[ip]), Vl, 1e-9, 'the pier shear takes the run with the lane load'); assert.ok(v.VL.withLane.VLmin[ip]);
  const sp = v.rows.filter(r => r.kind === 'shear' && Math.abs(r.x - 100) < 0.02).sort((a, b) => a.inv - b.inv)[0], gV = Math.max(R.ll.gVL[ip], R.ll.gVR[ip]);
  console.log(`       permit Type 3S2 (routine, ADTT 2000) on 100-100 ft continuous, shear at the pier: V_lane = ${Vt.toFixed(2)} kip (truck, IM 33 %) + ${dV.toFixed(2)} (0.2 klf) = ${Vl.toFixed(2)}; g_V = ${gV.toFixed(4)}; row LL = ${sp.LL.toFixed(2)}, C = ${sp.C.toFixed(1)}, DC = ${sp.DC.toFixed(1)}, DW = ${sp.DW.toFixed(1)}, γ_LL = ${v.gam.toFixed(4)}: RF = ${sp.inv.toFixed(3)} (without the lane load: ${((sp.C - 1.25 * sp.DC - 1.5 * sp.DW) / (v.gam * (sp.LL - gV * dV))).toFixed(3)})`);
  near(sp.inv, (sp.C - 1.25 * sp.DC - 1.50 * sp.DW) / (v.gam * sp.LL), 1e-5, 'pier shear RF');
  // ADTT 400: no lane load; the escorted permit: none either
  const P4 = JSON.parse(JSON.stringify(P)); P4.fatigue.ADTT = 400; const v4 = RU.build({ P: P4, g: 0, src: 'analysis', veh: true }).veh.list[0]; assert.equal(v4.laneLoad, false); assert.ok(/not above 500/.test(v4.laneWhy)); near(Math.abs(v4.VL.per.VLmin[ip]), Vt, 1e-9, 'ADTT 400: the truck alone');
  const Pe = JSON.parse(JSON.stringify(P)); Pe.rating.veh.permit.type = 'trip-escort'; const ve = RU.build({ P: Pe, g: 0, src: 'analysis', veh: true }).veh.list[0]; assert.equal(ve.laneLoad, false); assert.ok(/escorted/.test(ve.laneWhy));
  // Service II of a special permit: mixed with traffic → the design factor; escorted → the one-lane factor; Strength II one lane for both
  const S = simple(), mk = type => { const Q = JSON.parse(JSON.stringify(S)); Q.rating.veh = { on: [], permit: { key: 'Type3S2', type } }; const b = RU.build({ P: Q, g: 0, src: 'analysis', veh: true }); assert.ok(!b.err, b.err); return b.veh.list[0]; };
  const RS = RU.fromAnalysis(S, 0).R, i50 = RS.x.findIndex(x => Math.abs(x - 50) < 1e-9), mix = mk('trip-mixed'), esc = mk('trip-escort'), mul = mk('multi'), rou = mk('routine');
  const row = (v, kind, key) => v.rows.find(r => r.kind === kind && r.key === key && Math.abs(r.x - 50) < 1e-9), gD = RS.ll.gM[i50], g1 = RS.fat.gM[i50];
  assert.equal(mix.dfS, 'multi'); assert.ok(mix.VLs && mul.VLs && !esc.VLs && !rou.VLs); assert.equal(RU.dfCell(mix), 'one lane, no m (Service II: design)'); assert.equal(RU.dfCell(esc), 'one lane, no m'); assert.equal(RU.dfCell(rou), 'design');
  near(row(mix, 'flex', 'mp').LL, row(esc, 'flex', 'mp').LL, 1e-9, 'Strength II: the one-lane factor for both special permits'); near(row(mix, 'flex', 'mp').LL, g1 * 1.33 * 1322, 1e-6 * 1322, 'M = g_1/1.2 × 1.33 × 1,322.0');
  const sm = row(mix, 'svc', 'svb'), se = row(esc, 'svc', 'svb'), sr = row(rou, 'svc', 'svb');
  near(sm.LL / se.LL, gD / g1, 1e-9, 'Service II live-load stress: design factor / one-lane factor'); near(sm.LL, sr.LL, 1e-9, 'the same Service II stress as the routine permit (design factor)'); near(sm.DC, se.DC, 1e-12, 'same dead load');
  near(sm.inv, (sm.C - sm.DC - sm.DW - (sm.F || 0)) / (1.00 * sm.LL), 1e-9, 'Service II RF, γ_LL 1.00'); near(sm.inv, se.inv * g1 / gD, 1e-9, 'RF scales with the factor');
  const st = sm.steps.find(t => t.id === 'rt.LLv'); assert.ok(st && /design distribution factor/.test(st.note) && /C6A\.6\.4\.2\.2/.test(st.note), 'the Service II live-load step names the design factor'); assert.ok(/one-lane/.test(row(mix, 'flex', 'mp').steps.find(t => t.id === 'rt.LLv').note));
  assert.ok(mix.cap.get(sm) && mix.cap.get(sm).steps, 'the capacity location of the Service II row'); assert.ok(mix.rf <= esc.rf + 1e-12);
  console.log(`       special permit Type 3S2, single trip mixed with traffic, 100 ft simple span, x = 50 ft, Service II bottom flange: f_LL = ${se.LL.toFixed(3)} ksi with g_1/1.2 = ${g1.toFixed(4)} → ${sm.LL.toFixed(3)} ksi with g = ${gD.toFixed(4)}; f_R = ${sm.C.toFixed(2)}, f_DC = ${sm.DC.toFixed(3)}, f_DW = ${sm.DW.toFixed(3)}, f_l/2 = ${(sm.F || 0).toFixed(3)}: RF ${se.inv.toFixed(3)} → ${sm.inv.toFixed(3)}; governing RF ${esc.rf.toFixed(3)} (escorted) / ${mix.rf.toFixed(3)} (mixed), RT ${mix.rated.toFixed(1)} tons`);
  // lane-type legal model: W = 80 kip (40 tons) for the rated load and posting
  const L = RT.vehicleList({ on: ['Legal-Lane'] }, PRE, { adtt: 2000 }).list[0]; assert.equal(L.tons, 40); assert.equal(L.Weq, 80); assert.equal(L.post, true); assert.equal(L.W, 60); assert.equal(RT.LANE_W, 80);
  near(RT.posting(40, 0.8).P, 40 / 0.7 * 0.5, 1e-12, 'posting with W = 40 tons: 28.57 tons');
  const C = M.defaultProject(); C.rating = { phiC: 1, phiS: 1, veh: { on: ['Legal-Lane'] } }; const lv = RU.build({ P: C, g: 0, src: 'analysis', veh: true }).veh.list[0]; assert.ok(lv.rows, lv.err || lv.na);
  near(lv.rated, lv.rf * 40, 1e-9, 'lane-type model: RT = RF × 40 tons'); assert.ok(lv.posting && lv.posting.st); const ws = RU.vehSteps(lv); assert.equal(ws[0].value, 40); assert.ok(/6A\.4\.4\.4/.test(ws[0].ref));
  console.log(`       lane-type legal model on the default continuous girder: RF = ${lv.rf.toFixed(3)}, RT = RF × 40 tons = ${lv.rated.toFixed(1)} tons, posting ${lv.posting.st}`);
});
