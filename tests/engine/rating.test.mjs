// apps/steel-bridge/engine/rating.js (LRFR design-load rating) against ST-Girder's own rating (the st-src block of "Steel Bridge Design.html",
// computeAll's "Load rating (LRFR, MBE)" section), run in Node by tests/engine/st-source.mjs.
//
// 1. Rating formula and factors: on the 100 tests/projects/st/gd_*.json payloads (as ST-Girder holds them after the hand-off) plus
//    variations (φ_c φ_s below the 0.85 floor; two noncompact sections, ST-Girder's stress basis), every rating ST-Girder computes at
//    every station (flexure on the moment and stress basis, the pier negative flexure, shear, Service II both flanges and both LL signs),
//    with ST-Girder's own capacity C and demands DC, DW, LL fed to SBDRating.rf: the same Inventory and Operating RF (round-off, 1e-9
//    relative), and the governing values ST-Girder reports (flexInv/Opr, shearInv/Opr, negInv/Opr, servInv/Opr, govInv/Opr).
// 2. Full path: the same payloads rated with this app's capacities (engine/flexure.js, engine/shear.js), every span (ST-Girder
//    rates one span, chosen with its "Span n" button: stSpan): the change of each governing RF against ST-Girder (the distribution is printed), no RF crossing 1.0, and the bounds found on
//    2026-10-29 (positive flexure and shear: same; Service II +0.05 %; negative flexure +1.9 % to +7.2 %, the unified F_nc).
// 3. ui/rating.js build(): this app's built-in project from its own analysis, and a hand-off file (no exception, sensible results).
// 4. Hand checks (arithmetic in the comments): one flexure and one shear rating; φ_c φ_s floor; Service II; the owner target.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { stSession, stTrace, stSpan } from './st-source.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const W = loadShared('units.js', 'steps.js', E('engine/model.js'), E('engine/sections.js'), E('engine/owners.js'), E('engine/flexure.js'), E('engine/shear.js'), E('engine/rating.js'));
const FX = W.SBDFlexure, SH = W.SBDShear, RT = W.SBDRating;
const STD = path.join(ROOT, 'tests/projects/st');
const payloads = fs.readdirSync(STD).filter(f => /^gd_.*\.json$/.test(f)).sort();
const load = f => { const p = JSON.parse(fs.readFileSync(path.join(STD, f), 'utf8')); return p.payload || p; };
const clone = o => JSON.parse(JSON.stringify(o));
const close = (a, b, what) => { if (!isFinite(b) || b === 99) { assert.ok(!isFinite(a) || a === 99, `${what}: ${a} vs ST-Girder ${b}`); return; } assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${what}: ${a} vs ST-Girder ${b}`); };
const min = (L, k) => L.reduce((m, q) => Math.min(m, q[k]), Infinity);

/* 1. every ST-Girder rating, recomputed by SBDRating.rf from ST-Girder's own C, DC, DW, LL */
function formulaParity(name, s) {
  const { R, rt } = stTrace(s); assert.ok(R.ok, `${name}: ${R.error}`);
  const ra = R.rating, phCS = RT.phi(s.rate && s.rate.phiC, s.rate && s.rate.phiS).v;
  close(phCS, ra.phiCS, `${name} φcφs`);
  let n = 0;
  rt.flex.forEach(q => { [['inv', 1.75], ['opr', 1.35]].forEach(([k, g]) => {
    let v;
    if (q.basis === 'Mp') v = RT.rf({ C: q.C, DC: q.DC, DW: q.DW, LL: q.LL, gLL: g });
    else {   // stress basis: ST-Girder's sign, top + compression, bottom + tension (stageF)
      const c = RT.rf({ C: q.phi * q.Fc, DC: q.dc.fT, DW: q.dw.fT, P: q.u.fT, LL: q.fl.fT, gLL: g }), t = RT.rf({ C: q.phi * q.Ft, DC: q.dc.fB, DW: q.dw.fB, P: q.u.fB, LL: q.fl.fB, gLL: g });
      v = Math.min(isFinite(c) ? c : 99, isFinite(t) ? t : 99); }
    close(v, q[k], `${name} flexure ${q.basis} x=${q.x} ${k}`); n++; }); });
  rt.shear.forEach(q => [['inv', 1.75], ['opr', 1.35]].forEach(([k, g]) => { close(RT.rf({ C: q.C, DC: q.DC, DW: q.DW, LL: q.LL, gLL: g }), q[k], `${name} shear x=${q.x} ${k}`); n++; }));
  rt.neg.forEach(q => { assert.ok(q.fPerm < 0, `${name}: permanent stress at the pier in compression`);
    [['inv', 1.75], ['opr', 1.35]].forEach(([k, g]) => { close(RT.rf({ C: q.phi * q.Fnc, DC: -q.dc, DW: -q.dw, P: -q.u, LL: q.fLL1, gLL: g }), q[k], `${name} negative flexure ${k}`); n++; }); });
  rt.serv.forEach(q => { const sg = Math.sign(q.fl);
    [['inv', 1.30], ['opr', 1.00]].forEach(([k, g]) => { close(RT.rf({ C: q.fR, DC: sg * q.dc, DW: sg * q.dw, P: sg * q.u, gDC: 1, gDW: 1, gP: 1, LL: Math.abs(q.fl), gLL: g }), q[k], `${name} Service II ${q.tag} x=${q.x} ${k}`); n++; }); });
  // the governing values ST-Girder reports
  if (rt.flex.length) { close(min(rt.flex, 'inv'), ra.flexInv, `${name} flexInv`); close(min(rt.flex, 'opr'), ra.flexOpr, `${name} flexOpr`); }
  close(min(rt.shear, 'inv'), ra.shearInv, `${name} shearInv`);
  if (rt.neg.length) close(rt.neg[0].inv, ra.negInv, `${name} negInv`);
  if (rt.serv.length) { close(min(rt.serv, 'inv'), ra.servInv, `${name} servInv`); close(min(rt.serv, 'opr'), ra.servOpr, `${name} servOpr`); }
  close(Math.min(ra.flexInv, ra.shearInv, ra.negInv ?? 99, ra.servInv ?? 99), ra.govInv, `${name} govInv`);
  return { n, basis: [...new Set(rt.flex.map(q => q.basis))] };
}
test('rating formula and factors = ST-Girder on the 100 payloads, every span (every station, every check, Inventory and Operating)', () => {
  let n = 0, k = 0;
  payloads.forEach(f => { const pl = load(f), s = stSession(pl); assert.ok(s, f); for (let j = 0; j < pl.member.supports.length - 1; j++) { n += formulaParity(`${f} span ${j + 1}`, stSpan(s, j)).n; k++; } });
  assert.equal(k, 300); assert.ok(n > 60000, `${n} ratings compared`); console.log(`       ${n} ST-Girder ratings (300 spans) recomputed from ST-Girder's own C, DC, DW, LL+IM: all equal`);
});
test('rating formula = ST-Girder: φ_c φ_s (0.95 × 0.85 → the 0.85 floor; 0.95 × 1.0) and noncompact sections (stress basis)', () => {
  const pl = load('gd_builtin28_AASHTO_G1.json'), s0 = stSession(pl);
  [[0.95, 0.85], [0.95, 1.0], [0.85, 1.0]].forEach(([c, sy]) => formulaParity(`φc ${c} φs ${sy}`, { ...s0, rate: { phiC: c, phiS: sy } }));
  assert.equal(RT.phi(0.95, 0.85).v, 0.85); assert.ok(RT.phi(0.95, 0.85).floor); assert.equal(RT.phi(0.95, 1).v, 0.95);
  // noncompact: a narrow effective width puts the PNA in the web (ST-Girder rates on the stress basis)
  [[16, 0.375, null], [30, 0.4375, 1.875]].forEach(([beff, tw, tb]) => { const q = clone(pl); q.girderDetail.deck.beff = beff; q.section.zones.forEach(z => { z.web.thickness = tw; if (tb) z.botFlange.thickness = tb; });
    const r = formulaParity(`b_eff ${beff}, t_w ${tw}`, stSession(q)); assert.deepEqual(r.basis, ['stress']); });
});

/* 2. full path: this app's capacities on the same payloads, every span (ST-Girder rates the span selected with its "Span n" button) */
function rateApp(pl) {
  const plR = RT.noDoublePL(pl), F = FX.fromPayload(plR, { owner: (pl.ownerRules || {}).owner }), Gr = FX.girder(F.locs, F.prj, { supports: F.supports });
  const S = SH.fromPayload(plR, {}), cs = RT.shearCases(pl), opt = { phi: RT.phi(1, 1), mat: F.prj.mat }, rows = [];
  Gr.rows.forEach(r => rows.push(...RT.flexure(r, opt), ...RT.service(r, opt)));
  S.locs.forEach(L => rows.push(RT.shear(SH.location(L, S.prj), { ...opt, cases: cs(L.x) })));
  return (a, b) => RT.girder(rows.filter(q => q.x >= a - 1e-6 && q.x <= b + 1e-6), { owner: (pl.ownerRules || {}).owner });
}
test('full path: this app\'s capacities on the 100 payloads, every span — RF change against ST-Girder, no RF crosses 1.0', () => {
  const K = { flexInv: 'flexP', negInv: 'flexN', shearInv: 'shear', servInv: 'svc' }, rat = { flexInv: [], negInv: [], shearInv: [], servInv: [], govInv: [], govOpr: [] }, cross = [];
  let nS = 0;
  payloads.forEach(f => { const pl = load(f), sup = pl.member.supports, s0 = stSession(pl), app = rateApp(pl);
    for (let k = 0; k < sup.length - 1; k++) { const { R } = stTrace(stSpan(s0, k)), ra = R.rating, g = app(sup[k], sup[k + 1]); nS++;
      const mine = { ...Object.fromEntries(Object.entries(K).map(([kk, b]) => [kk, g.by[b] ? g.by[b].inv : NaN])), govInv: g.gov.inv.inv, govOpr: g.gov.opr.opr };
      Object.keys(rat).forEach(kk => { const a = ra[kk], b = mine[kk]; rat[kk].push(b / a); if ((a >= 1) !== (b >= 1)) cross.push(`${f} span ${k + 1} ${kk}: ST-Girder ${a.toFixed(3)}, this app ${b.toFixed(3)}`); }); } });
  assert.equal(nS, 300);
  const q = (L, p) => { const s = [...L].sort((a, b) => a - b); return s[Math.round(p * (s.length - 1))]; };
  console.log('       RF this app / ST-Girder, 100 payloads × 3 spans (min, 10 %, median, 90 %, max):');
  Object.entries(rat).forEach(([k, L]) => console.log(`         ${k.padEnd(8)} ${[0, 0.1, 0.5, 0.9, 1].map(p => q(L, p).toFixed(4)).join('  ')}`));
  assert.deepEqual(cross, [], 'RF crossing 1.0');
  const within = (k, lo, hi) => rat[k].forEach(v => assert.ok(v >= lo && v <= hi, `${k} ratio ${v} outside ${lo}..${hi}`));
  within('flexInv', 1 - 2e-4, 1 + 1e-4); within('shearInv', 1 - 1e-6, 1 + 1e-6); within('servInv', 1.0, 1.001); within('negInv', 1.015, 1.08);
});

/* 3. the tab's build */
test('ui/rating.js build(): the built-in project from this app\'s analysis, and a hand-off file', () => {
  const U = loadShared('units.js', 'steps.js', 'vehicles.js', 'moving-load.js', E('engine/model.js'), E('engine/sections.js'), E('engine/flexure.js'), E('engine/owners.js'), 'lldf.js', E('engine/lldf.js'), E('engine/loads.js'),
    E('engine/shear.js'), E('engine/stiffeners.js'), E('engine/analysis.js'), E('engine/fatigue.js'), E('engine/rating.js'), E('ui/shear.js'), E('ui/rating.js'));
  const P = U.SBDModel.defaultProject(), R = U.SBDRatingUI.build({ P, g: 0, src: 'analysis' });
  assert.ok(!R.err, R.err); assert.ok(R.rows.length > 300, `${R.rows.length} rows`);
  const s = R.sum; ['flexP', 'flexN', 'shear', 'svc'].forEach(k => assert.ok(s.by[k] && isFinite(s.by[k].inv) && s.by[k].inv > 0, k));
  assert.ok(s.gov.inv.inv > 0.5 && s.gov.inv.inv < 10, `governing inventory RF ${s.gov.inv.inv}`);
  console.log(`       built-in project, G1, this app's analysis: Inventory ${s.gov.inv.inv.toFixed(3)} (${s.gov.inv.title}, ${s.gov.inv.name}), Operating ${s.gov.opr.opr.toFixed(3)}; `
    + Object.entries(s.by).map(([k, q]) => `${k} ${q.inv.toFixed(3)}`).join(', '));
  R.rows.filter(q => !q.oos).forEach(q => { assert.ok(q.steps.length >= 5); assert.ok(R.cap.get(q), 'capacity location'); });
  assert.equal(U.SBDModel.validate({ ...P, rating: { phiC: 0.95, phiS: 1 } }).errors.length, 0);
  assert.ok(U.SBDModel.validate({ ...P, rating: { phiC: 1.2, phiS: 1 } }).errors.some(e => e.path === 'rating.phiC'));
  // φ_c = 0.85 and φ_s = 0.85 (0.7225 → 0.85): the Strength RFs scale, Service II does not
  const P2 = { ...P, rating: { phiC: 0.85, phiS: 0.85 } }, R2 = U.SBDRatingUI.build({ P: P2, g: 0, src: 'analysis' });
  assert.ok(R2.ph.floor && R2.ph.v === 0.85); assert.equal(R2.sum.by.svc.inv, s.by.svc.inv);
  // a hand-off file (CTDOT: the owner's targets, rating 1.20 and fatigue 1.20)
  const pl = load('gd_xsA_CTDOT_G1.json'), R3 = U.SBDRatingUI.build({ P, g: 0, pl });
  assert.ok(!R3.err, R3.err); assert.ok(R3.sum.target && R3.sum.target.rf === 1.2 && R3.sum.tgt.inv);
});

/* 4. hand checks */
test('hand check: flexure, compact positive section (moment basis), payload gd_builtin28_AASHTO_G1, x = 44 ft', () => {
  const pl = load('gd_builtin28_AASHTO_G1.json'), F = FX.fromPayload(pl, { owner: 'AASHTO' }), Gr = FX.girder(F.locs, F.prj, { supports: F.supports });
  const r = Gr.rows.find(q => Math.abs(q.x - 44) < 1e-9), q = RT.flexure(r, { phi: RT.phi(1, 1) })[0];
  assert.equal(q.key, 'mp'); assert.ok(r.compact && r.Mn === r.cap13);
  // M_n = min(M_n0, 1.3R_hM_y) = 1.3(1.0)(7,468.216) = 9,708.680 kip-ft (Flexure tab); C = φ_cφ_sφ_fM_n = 1.0(1.0)(1.0)(9,708.680)
  // DC = M_DC1 + M_DC2 = 838.305 + 262.866 = 1,101.171; DW = 159.930; LL+IM = 2,092.218 kip-ft
  // RF_inv = (9,708.680 − 1.25(1,101.171) − 1.50(159.930))/(1.75(2,092.218)) = (9,708.680 − 1,376.464 − 239.895)/3,661.382 = 8,092.322/3,661.382 = 2.2102
  // RF_op  = 8,092.322/(1.35(2,092.218)) = 8,092.322/2,824.494 = 2.8651
  assert.ok(Math.abs(r.MDC1 + r.MDC2 - 1101.171) < 0.001 && Math.abs(r.MDW - 159.93) < 0.001 && Math.abs(r.MLL - 2092.218) < 0.001);
  assert.ok(Math.abs(q.C - 9708.680) < 0.001, q.C);
  assert.ok(Math.abs(q.inv - 2.2102) < 5e-5, q.inv); assert.ok(Math.abs(q.opr - 2.8651) < 5e-5, q.opr);
  // ST-Girder: 2.2102 / 2.8651 at x = 44 (its M_n 9,708.681: its own M_y; same RF to 4 decimals)
  // φ_c = 0.95, φ_s = 0.85: φ_cφ_s = 0.8075 < 0.85, so 0.85 (MBE Eq. 6A.4.2.1-3); C = 0.85(9,708.680) = 8,252.378
  // RF_inv = (8,252.378 − 1,376.464 − 239.895)/3,661.382 = 6,636.019/3,661.382 = 1.8124
  const q2 = RT.flexure(r, { phi: RT.phi(0.95, 0.85) })[0];
  assert.ok(Math.abs(q2.C - 8252.378) < 0.001 && Math.abs(q2.inv - 1.8124) < 5e-5, q2.inv);
  const st = q.steps; assert.ok(st.find(x => x.id === 'rt.inv').value === q.inv && st.find(x => x.id === 'rt.Rn').note.includes('fx.mn.ok'));
});
test('hand check: shear at the pier, span 1 side (x = 109.99 ft), payload gd_builtin28_AASHTO_G1', () => {
  const pl = load('gd_builtin28_AASHTO_G1.json'), S = SH.fromPayload(pl, {}), L = S.locs.find(o => Math.abs(o.x - 109.99) < 1e-9), r = SH.location(L, S.prj);
  const cs = RT.shearCases(pl)(L.x), q = RT.shear(r, { phi: RT.phi(1, 1), cases: cs });
  // station 109.999 ft (the station 110.001 ft is across the support: not used): V_DC1 = 81.520, V_DC2 = 23.868, V_DW = 14.521,
  // V_LL+IM,pos = 122.355 kip (the direction of the dead load; the other direction: V_LL,neg = −3.855 with the dead load relieving, taken as 0)
  // V_n = 903.547 kip (interior stiffened panel, tension field, Eq. 6.10.9.3.2-2; Shear tab); C = 1.0(1.0)(1.0)(903.547)
  // RF_inv = (903.547 − 1.25(81.520 + 23.868) − 1.50(14.521))/(1.75(122.355)) = (903.547 − 131.735 − 21.782)/214.121 = 750.030/214.121 = 3.5028
  // RF_op  = 750.030/(1.35(122.355)) = 750.030/165.179 = 4.5407
  assert.ok(Math.abs(r.sh.Vn - 903.547) < 0.001, r.sh.Vn); assert.equal(q.dir, 1);
  assert.ok(Math.abs(q.DC - 105.388) < 1e-9 && Math.abs(q.DW - 14.521) < 1e-9 && Math.abs(q.LL - 122.355) < 1e-9);
  assert.ok(Math.abs(q.inv - 3.5028) < 5e-5, q.inv); assert.ok(Math.abs(q.opr - 4.5407) < 5e-5, q.opr);
  // ST-Girder at x = 110: 3.5028 / 4.5407
});
test('hand check: Service II, rf() with γ_D = 1.0; owner targets', () => {
  // f_R = 0.95(1.0)(50) = 47.5 ksi; f_DC = 12.905, f_DW = 1.6665, f_LL = 12.0274 ksi (top flange at the pier, tension)
  // RF_inv = (47.5 − 12.905 − 1.6665)/(1.30(12.0274)) = 32.9285/15.63562 = 2.1060; RF_op = 32.9285/12.0274 = 2.7378
  const o = { C: 47.5, DC: 12.905, DW: 1.6665, gDC: 1, gDW: 1, LL: 12.0274 };
  assert.ok(Math.abs(RT.rf({ ...o, gLL: 1.30 }) - 2.1060) < 5e-5); assert.ok(Math.abs(RT.rf({ ...o, gLL: 1.00 }) - 2.7378) < 5e-5);
  assert.equal(RT.rf({ C: 1, LL: 0, gLL: 1.75 }), Infinity);
  assert.equal(RT.target('AASHTO'), null); assert.equal(RT.target('RIDOT').rf, 1.10); assert.equal(RT.target('RIDOT').fat, 1.0); assert.equal(RT.target('CTDOT').rf, 1.20);
  assert.equal(RT.target('MassDOT').kind, 'report');
});
