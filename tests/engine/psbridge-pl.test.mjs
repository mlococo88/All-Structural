// apps/ps-bridge PL-A (2026-11-23): the pedestrian live load (AASHTO LRFD 10th Ed. Art. 3.6.1.6) and utility line loads (DW, Art. 3.5.1) in
// the girder design (engine/pl.js window.PSBPL, engine/bridge-dl.js pl() / line(); fixlog/ps-bridge.md PL-A). Made-up bridges.
//   1. The copy of computeAll that engine/pl.js runs for a girder with a pedestrian load: every edit anchor found once; with w_PL = 0 the
//      copy gives computeAll's own result on every parity case (recorded + 600 seeded + edge) at tolerance 0.
//   2. No pedestrian load and no utility row (every project saved before): the engine inputs have no "pl", and the results equal those of
//      the app loaded without engine/pl.js (the harness B designs and a new project).
//   3. Hand checks: w_PL per girder line by each method, M_PL, V_PL, the Strength I moment and the Service III bottom stress before / after;
//      the shear envelope; a continuous unit against the closed form; the 2.0 ft rule; fatigue, the LL deflection and R.MLL unchanged.
//   4. The worked steps reproduce the engine's values (ld.pl.*, the shear and pier steps).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';
import { recordedCases, seededCases, edgeCases } from './psbridge-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const ENG = ['sections', 'model', 'rigid', 'lldf-fg', 'pl', 'holddown', 'pierblock', 'rating-along', 'design', 'bridge', 'bridge-dl', 'demands', 'fields', 'inputcheck', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr'];
const load = list => loadShared('steps.js', ...PBDF, ...list.map(n => path.join(APP, `engine/${n}.js`)));
const W = load(ENG), W0 = load(ENG.filter(n => n !== 'pl'));
const M = W.PSBModel, D = W.PSBDesign, DL = W.PSBBridgeDL, PL = W.PSBPL;
const J = v => JSON.parse(JSON.stringify(v));
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''}: ${a} vs ${b}`);
// canonical text of a result: numbers by Object.is (NaN, ±Inf, −0 kept apart), functions by their values at sample arguments
const tag = v => Number.isNaN(v) ? '$NaN' : v === Infinity ? '$+Inf' : v === -Infinity ? '$-Inf' : Object.is(v, -0) ? '$-0' : v;
function canon(v, L, st = []) {
  if (typeof v === 'number') return tag(v);
  if (v === undefined) return '$undef';
  if (typeof v === 'function') { const l = +L > 0 ? +L : 100, a = v.length <= 1 ? [0, 0.5, 2.5, l * 0.1, l * 0.4, l / 2, l * 0.9, l].map(x => [x]) : [[l * 0.3, 250, 170, 1], [l / 2, 262, 160, 0.5]].map(q => q.slice(0, v.length));
    return { $fn: a.map(q => { try { return canon(v(...q), L, st); } catch (e) { return { $throw: String(e && e.message) }; } }) }; }
  if (v === null || typeof v !== 'object') return v;
  if (st.includes(v)) return '$cycle';
  if (ArrayBuffer.isView(v)) return Array.from(v, tag);
  st.push(v); let o; if (Array.isArray(v)) o = v.map(x => canon(x, L, st)); else { o = {}; for (const k of Object.keys(v)) o[k] = canon(v[k], L, st); } st.pop(); return o;
}
const text = (R, L) => JSON.stringify(canon(R, L));
const run = (Wx, P) => { const i = Wx.PSBDesign.inputs(P); return { i, R: Wx.PSBHoldDown.compute(J(i)) }; };
const mid = R => R.grid.reduce((a, r) => Math.abs(r.x - R.L / 2) < Math.abs(a.x - R.L / 2) ? r : a);
// the made-up bridge of the hand check: a new project (5 girders at 9 ft, overhangs 3 ft, one 120 ft span, barriers 1.5 ft wide) with a
// 6 ft left sidewalk, 9 in thick
const bridge = (method, ped) => { const P = M.newProject(); P.xs.dl.method = method || 'aashto'; P.xs.dl.swL = { w: 6, t: 9 }; if (ped != null) P.xs.dl.ped = ped; return P; };

test('the copy of computeAll: every edit anchor once; with w_PL = 0 it gives computeAll\'s result on every parity case (tolerance 0)', () => {
  const f = PL.engine(); assert.equal(typeof f, 'function'); assert.equal(PL.EDITS.length, 7);
  const src = W.computeAll.toString(); PL.EDITS.forEach(([a]) => assert.equal(src.split(a).length - 1, 1, a));
  const all = [...recordedCases(), ...seededCases(600), ...edgeCases()]; let n = 0, err = 0;
  for (const c of all) {
    const inp = J(W.mergeInputs(c.saved == null ? null : J(c.saved)));
    let A, B; try { A = text(W.computeAll(J(inp)), inp.L); } catch (e) { A = 'throw ' + e.message; }
    try { B = text(f(Object.assign(J(inp), { pl: { w: 0 } })), inp.L); } catch (e) { B = 'throw ' + e.message; }
    assert.equal(B, A, c.name); n++; if (/^throw/.test(A) || /"error":"/.test(A)) err++;
  }
  assert.ok(n >= 650, 'cases ' + n); assert.ok(err < n / 2, 'most cases compute');
  console.log(`  PL-A: the copy with w_PL = 0 = computeAll on ${n} cases (0 differences)`);
});

test('no pedestrian load, no utility row: no inputs.pl and the results of the app without engine/pl.js (harness B designs, new project)', () => {
  const cases = Object.assign({ newProject: M.newProject(), sidewalk: bridge('massdot') }, TAB_CASES(() => M.defaultProject())); let n = 0;
  for (const [name, P0] of Object.entries(cases)) {
    const P = M.importJSON(M.exportJSON(P0)).project, P2 = W0.PSBModel.importJSON(M.exportJSON(P0)).project;
    W.PSBBridge.fill(P); W0.PSBBridge.fill(P2);
    W.PSBBridge.cells(P).forEach(c => { const i = D.cellInputs(P, c.k, c.g), i0 = W0.PSBDesign.cellInputs(P2, c.k, c.g);
      assert.equal(i.pl, undefined, name); assert.equal(JSON.stringify(i), JSON.stringify(i0), `${name} G${c.g}/S${c.s} inputs`);
      assert.equal(text(W.PSBHoldDown.compute(J(i)), i.L), text(W0.PSBHoldDown.compute(J(i0)), i.L), `${name} G${c.g}/S${c.s} result`); n++; });
  }
  assert.ok(n >= 20, 'cells ' + n);
  console.log(`  PL-A: ${n} girder type × line results identical with and without engine/pl.js (defaults: no pedestrian load)`);
});

test('hand check (120 ft span, 5 girders at 9 ft, 6 ft sidewalk, 1.5 ft barrier, 75 psf): w_PL, M_PL, Strength I M_u, Service III f_bot', () => {
  // walkable width 6 − 1.5 = 4.5 ft; line load 0.075 × 4.5 = 0.3375 klf at 1.5 + 2.25 = 3.75 ft from the left deck edge
  const P = bridge('aashto', 75), q = DL.pl(P);
  assert.equal(q.per.length, 1); near(q.per[0].plf, 0.3375, 1e-12, 'line load'); near(q.per[0].x, 3.75, 1e-12, 'x');
  // 'aashto': equally to the 5 beams: 0.3375 / 5 = 0.0675 klf
  q.pl.forEach(v => near(v, 0.0675, 1e-12, 'equal share'));
  // 'massdot' pile-cap: girders at 3, 12, 21, 30, 39 ft; x̄ = 21; c = −18, −9, 0, 9, 18; Σc² = 810; e = 3.75 − 21 = −17.25
  //   G1: 0.3375/5 + 0.3375(−17.25)(−18)/810 = 0.0675 + 0.129375 = 0.196875; G2: 0.0675 + 0.0646875 = 0.1321875; G3 to G5: 0.0675 (no negative share)
  const qm = DL.pl(bridge('massdot', 75)).pl; [0.196875, 0.1321875, 0.0675, 0.0675, 0.0675].forEach((v, i) => near(qm[i], v, 1e-12, 'pile-cap G' + (i + 1)));
  // 'ridot': the two adjacent beams by the lever rule: x = 3.75 between G1 (3) and G2 (12): G1 0.3375 (12 − 3.75)/9 = 0.309375, G2 0.028125
  const qr = DL.pl(bridge('ridot', 75)).pl; [0.309375, 0.028125, 0, 0, 0].forEach((v, i) => near(qr[i], v, 1e-12, 'two adjacent G' + (i + 1)));
  // the girder shown (G2, interior), 'aashto': w_PL = 0.0675 klf; M_PL = 0.0675 × 120² / 8 = 121.5 kip-ft; V_PL = 0.0675 × 120 / 2 = 4.05 kip
  const a = run(W, bridge('aashto')), b = run(W, P);
  assert.equal(a.i.pl, undefined); near(b.i.pl.w, 0.0675, 1e-12, 'inputs.pl.w');
  assert.equal(JSON.stringify(Object.assign({}, b.i, { pl: undefined })), JSON.stringify(a.i), 'only inputs.pl is added');
  near(b.R.pl.Mmid, 121.5, 1e-9, 'M_PL'); near(b.R.pl.Vsup, 4.05, 1e-9, 'V_PL');
  const ma = mid(a.R), mb = mid(b.R), Sbc = b.R.cp.Sbc;
  near(mb.Mll - ma.Mll, 121.5 * 12, 1e-6, 'M_LL at midspan + M_PL');
  // Strength I: ΔM_u = 1.75 × 121.5 = 212.625 kip-ft (η = 1, m = 1)
  near((b.R.MuMid - a.R.MuMid) / 12, 212.625, 1e-6, 'Strength I M_u'); near((mb.Mu - ma.Mu) / 12, 212.625, 1e-6, 'grid M_u');
  // Service III: Δf_bot = −γ_LL M_PL / S_bc = −0.8 × 121.5 × 12 / S_bc
  near(mb.s3Bot - ma.s3Bot, -0.8 * 121.5 * 12 / Sbc, 1e-9, 'Service III bottom stress');
  // Service I top of girder: + M_PL / S_tg
  near(mb.s2Top - ma.s2Top, 121.5 * 12 / b.R.cp.Stg, 1e-9, 'Service I top stress');
  console.log(`  PL-A hand check G2: w_PL 0.0675 klf, M_PL 121.5 kip-ft; M_LL+IM ${(ma.Mll / 12).toFixed(1)} → ${(mb.Mll / 12).toFixed(1)} kip-ft; M_u ${(a.R.MuMid / 12).toFixed(1)} → ${(b.R.MuMid / 12).toFixed(1)} kip-ft; Service III f_bot ${ma.s3Bot.toFixed(4)} → ${mb.s3Bot.toFixed(4)} ksi (S_bc ${Sbc.toFixed(1)} in³)`);
  // not in fatigue, the LL deflection or the engine's HL-93 midspan / support values
  assert.equal(b.R.MLL, a.R.MLL); assert.equal(b.R.VLL, a.R.VLL); assert.equal(b.R.cam.dLL, a.R.cam.dLL); assert.equal(b.R.fat.Mfat1, a.R.fat.Mfat1); assert.equal(b.R.fat.dfbFat, a.R.fat.dfbFat);
  near(b.R.fat.fbPerm, a.R.fat.fbPerm, 1e-9, 'fatigue permanent stress');
  // the permanent-load results are the same; the dead loads too
  assert.equal(b.R.wBar, a.R.wBar); assert.equal(b.R.wDW, a.R.wDW); assert.equal(b.R.fpe, a.R.fpe);
});

test('shear: the envelope takes w_PL (L − x_m)² / (2 L) at the critical section; rating takes LL+IM + PL', () => {
  const a = run(W, bridge('massdot')), b = run(W, bridge('massdot', 75)), w = b.i.pl.w, L = 120;
  const k = b.R.shear.findIndex(s => !s.isBearing), sa = a.R.shear[k], sb = b.R.shear[k]; assert.equal(sa.x, sb.x);
  const xm = Math.min(sb.x, L - sb.x), v = w * (L - xm) * (L - xm) / (2 * L);
  near(sb.Vu - sa.Vu, 1.75 * v, 1e-9, 'V_u at the critical section'); near(PL.VplAt(b.R, sb.x), v, 1e-12, 'VplAt');
  // flexure rating: the same capacity and dead loads, LL+IM + PL in the denominator (as the Steel Bridge app)
  const ra = a.R.rating, rb = b.R.rating;
  if (ra.x === rb.x) near(rb.MLL - ra.MLL, w * rb.x * (L - rb.x) / 2, 1e-6, 'rating M_LL');
  assert.ok(rb.RFinv < ra.RFinv, 'RF lower with PL');
});

test('the 2.0 ft rule (3.6.1.6) and the off states', () => {
  const P = bridge('aashto', 75); P.xs.dl.swL.w = 2; let q = DL.pl(P); assert.equal(q.none, true); assert.deepEqual(J(q.narrow), ['L']); assert.equal(D.inputs(P).pl, undefined);
  P.xs.dl.swL.w = 2.5; q = DL.pl(P); assert.equal(q.none, false); near(q.per[0].plf, 0.075 * 1.0, 1e-12, '2.5 ft sidewalk, 1.0 ft walkable');
  const Q = bridge('aashto', 0); assert.equal(DL.pl(Q), null); assert.equal(D.inputs(Q).pl, undefined);
  const E = bridge('aashto', 75); E.xs.dl.mode = 'entered'; assert.equal(DL.pl(E), null); assert.equal(D.inputs(E).pl, undefined);
  const X = bridge('aashto', -5); assert.ok(DL.checks(X).some(e => e.path === 'xs.dl.ped'));
  // both sidewalks: two line loads
  const B = bridge('aashto', 75); B.xs.dl.swR = { w: 5, t: 9 }; q = DL.pl(B); assert.equal(q.per.length, 2); near(q.pl[0], (0.3375 + 0.075 * 3.5) / 5, 1e-12, 'two sidewalks');
});

test('continuous unit (2 × 100 ft): the pier M_PL = w L² / 8 (both spans loaded), the midspan + area, the checks take LL+IM + PL', () => {
  const mk = ped => { const P = bridge('aashto', ped); P.spans.lengths = [100, 100]; P.spans.continuity = 'composite'; P.xs.skews = [0, 0, 0]; W.PSBBridge.fill(P); return P; };
  const Pa = mk(null), Pb = mk(75); assert.deepEqual(J(W.PSBInputCheck.collect(Pb).errors.map(e => e.msg)), []);
  const a = run(W, Pa), b = run(W, Pb), w = b.i.pl.w, q = b.R.pl;
  assert.equal(a.R.error, null); assert.equal(b.R.error, null); assert.equal(q.mode, 'cont'); assert.ok(a.R.cont && b.R.cont);
  // the pier's influence line is negative over both spans: A− = −2 × L²/16 = −1250 ft² (closed form; the FE row within 0.5 %)
  near(q.pier[0].A, -1250, 1250 * 0.005, 'A− at the pier'); near(q.pier[0].M, -w * q.pier[0].A, 1e-12, 'M_PL,n');
  near(b.R.cont.MLLn - a.R.cont.MLLn, q.pier[0].M, 1e-9, 'pier M_LL + M_PL');
  near(b.R.cont.MuN - a.R.cont.MuN, 1.75 * q.pier[0].M * 12, 1e-6, 'pier M_u');
  // midspan of span 1, this span loaded: M = w L²/8 − (w L²/16)/2 = 0.09375 w L² → A+ = 937.5 ft² (within 0.5 %)
  near(q.AMp, 937.5, 937.5 * 0.005, 'A+ at midspan'); near(q.Mmid, w * q.AMp, 1e-12, 'M_PL at midspan');
  const ma = mid(a.R), mb = mid(b.R); near(mb.Mll - ma.Mll, q.Mmid * 12, 1e-6, 'grid M_LL at midspan');
  assert.equal(b.R.MLL, a.R.MLL); assert.equal(b.R.fat.Mfat1, a.R.fat.Mfat1);
});

test('imported demands: the pedestrian load is not added and a warning says so', () => {
  const ch = { MLLx: x => 1, VLLx: x => 2, MLLpos: x => 3, MLLneg: x => 4, VLLpos: x => 5, VLLneg: x => 6 };
  const o = PL.channels({ inp: { pl: { w: 0.1 } }, L: 100, useExt: true, useFE: false, fe: null }, ch);
  assert.equal(o.MLLx, ch.MLLx); assert.equal(o.VLLneg, ch.VLLneg); assert.equal(o.pierNeg({}), 0); assert.match(PL.WARN_EXT, /NOT added by this app/); assert.match(PL.WARN_EXT, /must already include/);
  const z = PL.channels({ inp: {}, L: 100, useExt: false, useFE: false, fe: null }, ch); assert.equal(z.MLLpos, ch.MLLpos);
});

test('utility line load (UT): DW (3.5.1), the steel app\'s distribution, added to the line\'s DW', () => {
  const P = bridge('massdot'), Q = bridge('massdot');
  P.xs.dl.extra = [{ name: 'Water main', cat: 'UT', x: 25, plf: 0.06 }]; assert.deepEqual(J(DL.checks(P)), []);
  const R = DL.distribute(P), R0 = DL.distribute(Q);
  assert.equal(C(R.dw), C(R0.dw)); assert.equal(C(R.dc2), C(R0.dc2));   // the DC2 and DW of the other loads are unchanged
  // pile-cap: x̄ = 21, Σc² = 810, e = 4: G5 0.06/5 + 0.06(4)(18)/810 = 0.012 + 0.0053333 = 0.0173333; G1 0.012 (no negative share)
  near(R.ut[4], 0.06 / 5 + 0.06 * 4 * 18 / 810, 1e-12, 'UT G5'); near(R.ut[0], 0.012, 1e-12, 'UT G1');
  for (let g = 1; g <= 5; g++) { const l = DL.line(P, g), l0 = DL.line(Q, g); near(l.DW, l0.DW + R.ut[g - 1], 1e-15, 'DW + UT'); assert.equal(l.DWonly, l0.DW); assert.equal(l.DC2, l0.DC2); }
  const i = D.inputs(P), i0 = D.inputs(Q); near(i.loads.wDW, i0.loads.wDW + R.ut[1], 1e-15, 'engine w_DW'); assert.equal(i.pl, undefined);
  const S = DL.stepsFor(P, 2).map(s => s.id); assert.ok(S.includes('dl.G2.UT') && S.includes('dl.G2.DWt') && !S.includes('dl.G2.UF'));
  const st = DL.stepsFor(P, 2).find(s => s.id === 'dl.G2.DWt'); near(st.value, i.loads.wDW, 1e-15, 'step DWt');
  assert.equal(DL.line(Q, 2).UT, undefined); assert.ok(!DL.stepsFor(Q, 2).some(s => /UT|DWt/.test(s.id)));
});
function C(a) { return JSON.stringify(Array.from(a)); }

test('worked steps: ld.pl.* and the shear / pier steps reproduce the engine\'s values', () => {
  for (const mk of [() => bridge('ridot', 75), () => { const P = bridge('aashto', 75); P.spans.lengths = [100, 100]; P.spans.continuity = 'composite'; P.xs.skews = [0, 0, 0]; W.PSBBridge.fill(P); return P; }]) {
    const P = mk(), { i, R } = run(W, P); assert.equal(R.error, null);
    const ST = { loads: W.PSBWorked.loads(i, R), analysis: W.PSBWorked.analysis(i, R), stresses: W.PSBWorkedStress.stresses(i, R), flexure: W.PSBWorkedStrength.flexure(i, R), shear: W.PSBWorkedStrength.shear(i, R), rating: W.PSBWorkedHDR.rating(i, R) };
    let n = 0; const at = (o, p) => p.split('.').reduce((q, k) => q == null ? q : q[k], o);
    for (const r of Object.values(ST)) { r.pairs.forEach(p => { n++; near(p.shown, p.engine, 1e-9 * Math.max(1, Math.abs(p.engine)), p.id); });
      Object.entries(r.paths || {}).forEach(([id, p]) => { const s = r.steps.find(q => q.id === id); assert.ok(Object.is(s.value, at(R, p)), id); }); }
    assert.ok(n > 100);
    const ids = ST.loads.steps.map(s => s.id); ['ld.pl.w', 'ld.pl.M', 'ld.pl.V', 'ld.pl.MLLPL', 'ld.pl.VLLPL'].forEach(id => assert.ok(ids.includes(id), id));
    if (R.pl.mode === 'cont') assert.ok(ids.includes('ld.pl.Mn0'));
    DL.withSteps(ST.loads, P); const g = D.sel(P).g, s = ST.loads.steps.find(q => q.id === `dl.G${g}.PL`); assert.ok(s, 'w_PL step of the line'); near(s.value, R.pl.w, 1e-15, 'w_PL step');
    assert.ok(ST.loads.steps.some(q => /^dl\.load\.ped[LR]$/.test(q.id)));
  }
});
