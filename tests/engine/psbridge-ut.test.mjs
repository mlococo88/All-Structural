// apps/ps-bridge UT-N (2026-11-23): utilities on the noncomposite section with the DW load factors (stored category 'UTN', the Steel Bridge
// app's UT) and the future utility allowance, noncomposite, γ 1.25 or 0 (category 'UF') in the girder design (engine/ut.js window.PSBUT,
// engine/bridge-dl.js, engine/design.js, engine/rating-along.js; fixlog/ps-bridge.md UT-N). Made-up bridges.
//   1. The copy of computeAll that engine/ut.js runs: every edit anchor found the stated number of times; with no such load the copy gives
//      computeAll's own result on every parity case (recorded + 600 seeded + edge) at tolerance 0; also on top of engine/pl.js's copy.
//   2. No such row (every project saved before, the composite "Utility (DW)" rows of PL-A included): no inputs.ut, and the results equal
//      those of the app loaded without engine/ut.js (the harness B designs, a new project, a composite utility project).
//   3. Hand check (120 ft span, 5 BT-72 at 9 ft, UT 0.10 klf and UF 0.05 klf on one line): the shares by each method, M at midspan,
//      Strength I M_u and V_u, the Service III bottom stress on the girder section, the camber, the rating, before / after.
//   4. UF present = a DC1 line load; UF absent = the project without the row; the larger ratio of each check is in R.checks.
//   5. A continuous unit: the negative-moment rating takes UT at 0.65 and the allowance absent. A negative share: γ_UT 0.65.
//   6. The worked steps reproduce the engine's values on every tab; the pedestrian load and the utilities together.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';
import { recordedCases, seededCases, edgeCases } from './psbridge-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const ENG = ['sections', 'model', 'rigid', 'lldf-fg', 'ut', 'pl', 'holddown', 'pierblock', 'rating-along', 'design', 'bridge', 'bridge-dl', 'demands', 'fields', 'inputcheck', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr'];
const load = list => loadShared('steps.js', ...PBDF, ...list.map(n => path.join(APP, `engine/${n}.js`)));
const W = load(ENG), W0 = load(ENG.filter(n => n !== 'ut'));
const M = W.PSBModel, D = W.PSBDesign, DL = W.PSBBridgeDL, UT = W.PSBUT;
const J = v => JSON.parse(JSON.stringify(v));
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''}: ${a} vs ${b}`);
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
// the made-up bridge of the hand check: a new project (5 BT-72 at 9 ft, overhangs 3 ft, one 120 ft span; girder lines at 3, 12, 21, 30,
// 39 ft from the left deck edge) with the line loads `rows` at x = 16.5 ft (between G2 and G3)
const UTR = { name: 'Gas main', cat: 'UTN', x: 16.5, plf: 0.10 }, UFR = { name: 'Future utility bay', cat: 'UF', x: 16.5, plf: 0.05 };
const bridge = (method, rows) => { const P = M.newProject(); P.xs.dl.method = method || 'aashto'; P.xs.dl.extra = J(rows || []); return P; };
const cont = P => { P.spans.lengths = [100, 100]; P.spans.continuity = 'composite'; P.xs.skews = [0, 0, 0]; W.PSBBridge.fill(P); return P; };
const chk = (R, n) => R.checks.find(c => c.n === n);

test('the copy of computeAll: every anchor found; with no utility load it gives computeAll\'s result on every parity case (tolerance 0)', () => {
  const src = W.computeAll.toString(); assert.equal(UT.EDITS.length, 10);
  UT.EDITS.forEach(([a, , k]) => assert.equal(src.split(a).length - 1, k, a));
  const f = UT.engine(W.computeAll); assert.equal(typeof f, 'function'); assert.equal(UT.engine(W.computeAll), f, 'made once');
  const all = [...recordedCases(), ...seededCases(600), ...edgeCases()]; let n = 0, err = 0;
  for (const c of all) {
    const inp = J(W.mergeInputs(c.saved == null ? null : J(c.saved)));
    let A, B; try { A = text(W.computeAll(J(inp)), inp.L); } catch (e) { A = 'throw ' + e.message; }
    try { B = text(f(Object.assign(J(inp), { ut: { wUT: 0, wUF: 0, wNC0: +inp.loads.wNC } })), inp.L); } catch (e) { B = 'throw ' + e.message; }
    assert.equal(B, A, c.name); n++; if (/^throw/.test(A) || /"error":"/.test(A)) err++;
  }
  assert.ok(n >= 650, 'cases ' + n); assert.ok(err < n / 2, 'most cases compute');
  // on top of the pedestrian load's copy (a girder with both): the copy of the copy, no load of either = the engine
  const g = UT.engine(W.PSBPL.engine()); let m = 0;
  for (const c of all.slice(0, 120)) { const inp = J(W.mergeInputs(c.saved == null ? null : J(c.saved)));
    let A, B; try { A = text(W.computeAll(J(inp)), inp.L); } catch (e) { A = 'throw ' + e.message; }
    try { B = text(g(J(inp)), inp.L); } catch (e) { B = 'throw ' + e.message; }
    assert.equal(B, A, c.name); m++; }
  console.log(`  UT-N: the copy with no utility load = computeAll on ${n} cases, and on top of the pedestrian copy on ${m} (0 differences)`);
});

test('no noncomposite utility row: no inputs.ut and the results of the app without engine/ut.js (harness B designs, new project, composite utility)', () => {
  const comp = bridge('massdot', [{ name: 'Water main', cat: 'UT', x: 25, plf: 0.06 }]), side = bridge('aashto'); side.xs.dl.swL = { w: 6, t: 9 }; side.xs.dl.ped = 75;
  const cases = Object.assign({ newProject: M.newProject(), compositeUT: comp, pedestrian: side }, TAB_CASES(() => M.defaultProject())); let n = 0;
  for (const [name, P0] of Object.entries(cases)) {
    const P = M.importJSON(M.exportJSON(P0)).project, P2 = W0.PSBModel.importJSON(M.exportJSON(P0)).project;
    W.PSBBridge.fill(P); W0.PSBBridge.fill(P2);
    W.PSBBridge.cells(P).forEach(c => { const i = D.cellInputs(P, c.k, c.g), i0 = W0.PSBDesign.cellInputs(P2, c.k, c.g);
      assert.equal(i.ut, undefined, name); assert.equal(JSON.stringify(i), JSON.stringify(i0), `${name} G${c.g}/S${c.s} inputs`);
      const R = W.PSBHoldDown.compute(J(i)); assert.equal(R.ut, undefined);
      assert.equal(text(R, i.L), text(W0.PSBHoldDown.compute(J(i0)), i.L), `${name} G${c.g}/S${c.s} result`); n++; });
  }
  assert.ok(n >= 20, 'cells ' + n);
  // the composite utility of PL-A is unchanged by the new categories: DW + its share, no inputs.ut, the same steps
  const l = DL.line(comp, 5); near(l.UT, 0.06 / 5 + 0.06 * 4 * 18 / 810, 1e-12, 'composite UT G5'); assert.equal(l.UTN, undefined); assert.equal(l.UF, undefined);
  assert.equal(DL.distribute(comp).xu, undefined);
  console.log(`  UT-N: ${n} girder type × line results identical with and without engine/ut.js (no noncomposite utility row)`);
});

test('distribution to the girder lines, as the Steel Bridge app distributes its UT / UF rows (each method)', () => {
  // 'aashto': equally: 0.10 / 5 = 0.02, 0.05 / 5 = 0.01 klf on every line
  let R = DL.distribute(bridge('aashto', [UTR, UFR]));
  R.xu.utn.forEach(v => near(v, 0.02, 1e-15, 'UT equal')); R.xu.uf.forEach(v => near(v, 0.01, 1e-15, 'UF equal')); assert.equal(R.xu.hasC, false);
  // 'massdot' pile-cap: x̄ = 21, c = −18, −9, 0, 9, 18, Σc² = 810, e = 16.5 − 21 = −4.5:
  //   UT: G1 0.02 + 0.10(−4.5)(−18)/810 = 0.03; G2 0.02 + 0.10(−4.5)(−9)/810 = 0.025; G3 to G5 0.02 (no negative share)
  R = DL.distribute(bridge('massdot', [UTR, UFR]));
  [0.03, 0.025, 0.02, 0.02, 0.02].forEach((v, i) => { near(R.xu.utn[i], v, 1e-15, 'UT pile-cap G' + (i + 1)); near(R.xu.uf[i], v / 2, 1e-15, 'UF pile-cap G' + (i + 1)); });
  // 'ridot': the two adjacent beams (the steel app's rAuto for UT / UF): x = 16.5 midway between G2 (12) and G3 (21): 0.05 and 0.05; UF 0.025 each
  R = DL.distribute(bridge('ridot', [UTR, UFR]));
  [0, 0.05, 0.05, 0, 0].forEach((v, i) => { near(R.xu.utn[i], v, 1e-15, 'UT two adjacent G' + (i + 1)); near(R.xu.uf[i], v / 2, 1e-15, 'UF two adjacent G' + (i + 1)); });
  assert.equal(R.per.find(L => L.cat0 === 'UTN').dist, 'two'); assert.equal(R.per.find(L => L.cat0 === 'UF').dist, 'two');
  // the same shares as the steel app's own dead() gives its categories UT and UF (the copy in this file is that function)
  const S = DL.distribute(bridge('ridot', [UTR, UFR])); assert.equal(JSON.stringify(Array.from(S.ut)), JSON.stringify(Array.from(S.xu.utn))); assert.equal(JSON.stringify(Array.from(S.uf)), JSON.stringify(Array.from(S.xu.uf)));
  // with a composite utility too: three sums, the composite one added to DW only
  const P = bridge('aashto', [UTR, UFR, { name: 'Water main', cat: 'UT', x: 25, plf: 0.06 }]), l = DL.line(P, 2), l0 = DL.line(bridge('aashto'), 2);
  near(l.UT, 0.012, 1e-15, 'composite'); near(l.UTN, 0.02, 1e-15, 'noncomposite'); near(l.UF, 0.01, 1e-15, 'allowance'); near(l.DW, l0.DW + 0.012, 1e-15, 'DW + composite UT only'); assert.equal(l.DC2, l0.DC2);
  const ids = DL.stepsFor(P, 2).map(s => s.id); ['dl.G2.UT', 'dl.G2.DWt', 'dl.G2.UTN', 'dl.G2.UF'].forEach(id => assert.ok(ids.includes(id), id));
  near(DL.stepsFor(P, 2).find(s => s.id === 'dl.G2.UT').value, 0.012, 1e-15, 'step UT = the composite rows only');
  // the row's own distribution, the entered mode, the input check
  const T = bridge('aashto', [Object.assign({}, UTR, { dist: 'two' })]); near(DL.line(T, 2).UTN, 0.05, 1e-15, 'row distribution');
  const E = bridge('aashto', [UTR]); E.xs.dl.mode = 'entered'; assert.equal(DL.line(E, 2), null); assert.equal(D.inputs(E).ut, undefined);
  assert.deepEqual(J(DL.checks(bridge('aashto', [UTR, UFR]))), []); assert.ok(DL.checks(bridge('aashto', [{ name: 'x', cat: 'XX', x: 3, plf: 0.1 }])).some(e => e.path === 'xs.dl.extra.0.cat'));
  // saved data: the rows travel in the project JSON as entered
  const back = M.importJSON(M.exportJSON(bridge('ridot', [UTR, UFR]))).project; assert.deepEqual(J(back.xs.dl.extra), [UTR, UFR]);
});

test('hand check (120 ft span, 5 BT-72 at 9 ft, UT 0.10 klf and UF 0.05 klf on one line, equally): M, Strength I M_u, V_u, Service III f_bot, camber, rating', () => {
  const a = run(W, bridge('aashto')), b = run(W, bridge('aashto', [UTR, UFR])), L = 120;
  assert.equal(a.R.error, null); assert.equal(b.R.error, null); assert.equal(a.i.ut, undefined);
  // G2: w_UT = 0.02 klf, w_UF = 0.01 klf; added to w_NC (0.10 entered): 0.13 klf
  near(b.i.ut.wUT, 0.02, 1e-15, 'w_UT'); near(b.i.ut.wUF, 0.01, 1e-15, 'w_UF'); assert.equal(b.i.ut.wNC0, a.i.loads.wNC); near(b.i.loads.wNC, a.i.loads.wNC + 0.03, 1e-15, 'w_NC');
  const ia = J(a.i), ib = J(b.i); delete ib.ut; ib.loads.wNC = ia.loads.wNC; assert.equal(JSON.stringify(ib), JSON.stringify(ia), 'only w_NC and inputs.ut change');
  // M_UT = 0.02 × 120² / 8 = 36 kip-ft; M_UF = 0.01 × 120² / 8 = 18 kip-ft; V at the support 1.2 and 0.6 kip
  const q = b.R.ut; near(q.MUT, 36, 1e-12, 'M_UT'); near(q.MUF, 18, 1e-12, 'M_UF'); near(q.VUT, 1.2, 1e-12, 'V_UT'); near(q.VUF, 0.6, 1e-12, 'V_UF'); assert.equal(q.gUT, 1.5);
  const ma = mid(a.R), mb = mid(b.R), G = b.R.g;
  near(mb.Mdk - ma.Mdk, 54 * 12, 1e-6, 'M_DC1 + M_UT + M_UF');
  // Strength I: ΔM_u = 1.50 × 36 + 1.25 × 18 = 54 + 22.5 = 76.5 kip-ft (η = 1); = 1.25 × 54 in the DC1 term + 0.25 × 36
  near((b.R.MuMid - a.R.MuMid) / 12, 76.5, 1e-6, 'Strength I M_u'); near((mb.Mu - ma.Mu) / 12, 76.5, 1e-6, 'grid M_u'); near(q.MuU, 76.5, 1e-12, 'M_u,U'); near(q.dMu, 9, 1e-12, 'ΔM_u,UT');
  const da = a.R.diagrams.find(r => r.x === ma.x), db = b.R.diagrams.find(r => r.x === mb.x);
  near(db.M_StrI_pos - da.M_StrI_pos, 76.5, 1e-9, 'Analysis M_u+'); near(db.M_SrvI_pos - da.M_SrvI_pos, 54, 1e-9, 'Service I moment');
  // the negative envelope: UT at 0.65, the allowance absent: 0.65 × 36 = 23.4 kip-ft
  near(db.M_StrI_neg - da.M_StrI_neg, 23.4, 1e-9, 'Analysis M_u−');
  // Service III bottom stress at midspan: the utilities on the GIRDER section (S_b), γ = 1.00: −(36 + 18) × 12 / S_b, plus the change of the
  // prestress force (the sustained load is in Δf_cd of the creep loss, as DC1)
  const dPe = mb.Aps * (b.R.fpe - a.R.fpe), dfb = -54 * 12 / G.Sb;
  near(q.fb, dfb, 1e-15, 'f_b,U'); near(mb.s3Bot - ma.s3Bot, dfb + dPe * (1 / G.A + mb.e / G.Sb), 1e-9, 'Service III bottom stress');
  near(mb.s1Top - ma.s1Top, 54 * 12 / G.St + dPe * (1 / G.A - mb.e / G.St), 1e-9, 'Service I top stress');
  assert.ok(Math.abs(G.Sb - b.R.cp.Sbc) > 1000, 'the girder section, not the composite one');
  // the elastic gain of the deck-stage loads: + (E_p/E_c)(54 × 12) e_m / I
  near(b.R.gains.precast - a.R.gains.precast, q.gain, 1e-9, 'elastic gain'); assert.equal(b.R.gains.composite, a.R.gains.composite);
  // shear at the critical section: ΔV_u = 1.50 V_UT(x) + 1.25 V_UF(x), V(x) = w (L/2 − x)
  // (the critical section itself moves a hair with d_v, so the engine's shear stations along the span are compared: the same x)
  const k = b.R.shearDiag.findIndex(s => s.x > 5 && s.x < 20), sa = a.R.shearDiag[k], sb = b.R.shearDiag[k]; assert.equal(sa.x, sb.x);
  near(sb.Vu - sa.Vu, 1.5 * 0.02 * (L / 2 - sb.x) + 1.25 * 0.01 * (L / 2 - sb.x), 1e-9, 'V_u at a shear station');
  const c = b.R.shear.find(s => !s.isBearing), c0 = run(W, bridge('aashto', [Object.assign({}, UTR, { cat: 'DC1' }), Object.assign({}, UFR, { cat: 'DC1' })])).R.shear.find(s => !s.isBearing);
  assert.equal(c.x, c0.x); near(c.Vu - c0.Vu, 0.25 * 0.02 * (L / 2 - c.x), 1e-9, 'V_u at the critical section: 0.25 V_UT above the same loads as DC1');
  // camber: the utility is in Δ_dk, the allowance is not: ΔΔ_dk = 5 (0.02/12) L⁴ / (384 E_c I_g)
  near(b.R.cam.dDK - a.R.cam.dDK, 5 * (0.02 / 12) * Math.pow(L * 12, 4) / (384 * b.R.cp.Ecg * G.I), 1e-12, 'Δ_dk'); near(q.dUT, b.R.cam.dDK - a.R.cam.dDK, 1e-12, 'Δ_UT');
  assert.equal(b.R.cam.dPS, a.R.cam.dPS); assert.equal(b.R.cam.dSD, a.R.cam.dSD); assert.equal(b.R.cam.dLL, a.R.cam.dLL);
  // rating (as the Steel Bridge app): UT with DW, the allowance with DC, at the rated station x
  const ra = a.R.rating, rb = b.R.rating; assert.equal(ra.x, rb.x); const mx = w => w * rb.x * (L - rb.x) / 2;
  near(rb.MDW - ra.MDW, mx(0.02), 1e-9, 'rating M_DW + M_UT'); near(rb.MDC - ra.MDC, mx(0.01), 1e-9, 'rating M_DC + M_UF');
  near(rb.RFinv, (rb.phiCS * rb.Rn - 1.25 * rb.MDC - 1.5 * rb.MDW) / (1.75 * rb.MLL), 1e-12, 'RF'); assert.ok(rb.RFinv < ra.RFinv);
  near(rb.mid.MDW - ra.mid.MDW, 36, 1e-9, 'midspan M_DW'); near(rb.mid.MDC - ra.mid.MDC, 18, 1e-9, 'midspan M_DC');
  const va = a.R.shrRating, vb = b.R.shrRating; assert.equal(va.x, vb.x);
  near(vb.VDW - va.VDW, 0.02 * (L / 2 - vb.x), 1e-9, 'rating V_DW + V_UT'); near(vb.VDC - va.VDC, 0.01 * (L / 2 - vb.x), 1e-9, 'rating V_DC + V_UF');
  // unchanged: the composite loads, the live load, the release checks
  assert.equal(b.R.wBar, a.R.wBar); assert.equal(b.R.wDW, a.R.wDW); assert.equal(b.R.MLL, a.R.MLL); assert.equal(chk(b.R, 'Release comp').r, chk(a.R, 'Release comp').r);
  console.log(`  UT-N hand check G2: w_UT 0.0200, w_UF 0.0100 klf; M_UT 36.0, M_UF 18.0 kip-ft; M_u ${(a.R.MuMid / 12).toFixed(1)} → ${(b.R.MuMid / 12).toFixed(1)} kip-ft; Service III f_bot ${ma.s3Bot.toFixed(4)} → ${mb.s3Bot.toFixed(4)} ksi (S_b ${G.Sb.toFixed(1)} in³, direct ${dfb.toFixed(4)}); Δ_dk ${a.R.cam.dDK.toFixed(4)} → ${b.R.cam.dDK.toFixed(4)} in; RF_inv ${ra.RFinv.toFixed(3)} → ${rb.RFinv.toFixed(3)}`);
});

test('the allowance present = a DC1 line load; absent = the project without it; a check with a larger ratio absent is added to R.checks', () => {
  const dc1 = run(W, bridge('aashto', [Object.assign({}, UFR, { cat: 'DC1' })])), uf = run(W, bridge('aashto', [UFR])), none = run(W, bridge('aashto'));
  assert.equal(dc1.i.ut, undefined); near(uf.i.loads.wNC, dc1.i.loads.wNC, 1e-15, 'the same w_NC');
  // present: every station, the strength and the checks as with the same load entered as DC1 (γ_DC 1.25, Service 1.00)
  assert.equal(text(uf.R.grid, 120), text(dc1.R.grid, 120)); assert.equal(text(uf.R.shear, 120), text(dc1.R.shear, 120)); assert.equal(uf.R.MuMid, dc1.R.MuMid); assert.equal(uf.R.fpe, dc1.R.fpe);
  dc1.R.checks.forEach((c, i) => { assert.equal(uf.R.checks[i].n, c.n); assert.ok(Object.is(uf.R.checks[i].r, c.r), c.n); });
  assert.equal(text(uf.R.rating, 120), text(dc1.R.rating, 120));
  // but not in the camber: Δ_dk as without the row
  near(uf.R.cam.dDK, none.R.cam.dDK, 1e-12, 'Δ_dk without the allowance'); assert.ok(dc1.R.cam.dDK > uf.R.cam.dDK);
  // absent: the rows of R.ut.abs hold both ratios; the added checks are the no-row project's checks, only where larger
  const A = uf.R.ut.abs; assert.equal(A.rows.length, dc1.R.checks.length);
  A.rows.forEach(r => { const c0 = chk(none.R, r.n), cP = chk(dc1.R, r.n); assert.ok(Object.is(r.rA, c0.r), r.n + ' absent'); assert.ok(Object.is(r.rP, cP.r), r.n + ' present');
    const add = chk(uf.R, UT.PRE + r.n);
    if (r.gov === 'absent') { assert.ok(r.rA > r.rP, r.n); assert.ok(add && Object.is(add.r, c0.r) && add.pass === c0.pass && add.lim === c0.lim && add.v === c0.v, 'added ' + r.n); }
    else { assert.ok(!(r.rA > r.rP * (1 + 1e-9) + 1e-12), r.n); assert.equal(add, undefined); } });
  assert.equal(uf.R.checks.length, dc1.R.checks.length + A.n); assert.deepEqual(J(A.gov), J(A.rows.filter(r => r.gov === 'absent').map(r => UT.PRE + r.n)));
  // every check of the design: the governing ratio is the larger of the two states
  A.rows.forEach(r => { const worst = Math.max(...uf.R.checks.filter(c => c.n === r.n || c.n === UT.PRE + r.n).map(c => c.r)); assert.equal(worst, Math.max(r.rP, r.rA), r.n); });
  // a utility alone: one run, no second state; the service stresses as with DC1, the strength above it by 0.25 M_UT
  const u = run(W, bridge('aashto', [UTR])), d = run(W, bridge('aashto', [Object.assign({}, UTR, { cat: 'DC1' })]));
  assert.equal(u.R.ut.abs, undefined); assert.equal(u.R.fpe, d.R.fpe); assert.equal(u.R.cam.dDK, d.R.cam.dDK);
  u.R.grid.forEach((r, i) => { const s = d.R.grid[i]; ['s1Top', 's2Top', 's3Bot', 'relTop', 'relBot', 'Mdk'].forEach(k => assert.ok(Object.is(r[k], s[k]), k)); near(r.Mu - s.Mu, 0.25 * 0.02 * r.x * (120 - r.x) / 2 * 12, 1e-6, 'M_u(x)'); });
  ['Srv comp (perm)', 'Srv comp (full)', 'Srv III tens', 'Fatigue I (strand)', 'Fatigue I (concrete, 5.5.3.1)'].forEach(n => assert.ok(Object.is(chk(u.R, n).r, chk(d.R, n).r), n));
  assert.ok(chk(u.R, 'Flexure').r > chk(d.R, 'Flexure').r); assert.ok(chk(u.R, 'Shear').r > chk(d.R, 'Shear').r);
});

test('continuous unit (2 × 100 ft): the pier check has no noncomposite load; the negative-moment rating takes UT at 0.65 and the allowance absent', () => {
  const a = run(W, cont(bridge('aashto'))), b = run(W, cont(bridge('aashto', [UTR, UFR]))), L = 100;
  assert.equal(a.R.error, null); assert.equal(b.R.error, null); assert.ok(b.R.cont);
  assert.equal(b.R.cont.MDC2n, a.R.cont.MDC2n); assert.equal(b.R.cont.MDWn, a.R.cont.MDWn); assert.equal(b.R.cont.MLLn, a.R.cont.MLLn);
  // the utilities act on the simple span (a noncomposite load): M_UT at midspan = 0.02 × 100² / 8 = 25 kip-ft
  near(b.R.ut.MUT, 25, 1e-12, 'M_UT'); near(mid(b.R).Mdk - mid(a.R).Mdk, 37.5 * 12, 1e-6, 'M_DC1 on the simple span');
  const A = W.PSBRatingAlong.of(b.R), A0 = W.PSBRatingAlong.of(a.R), N = A.rows.filter(r => r.kind === 'flexN'), N0 = A0.rows.filter(r => r.kind === 'flexN');
  assert.ok(N.length > 3); assert.equal(N.length, N0.length);
  N.forEach((r, i) => { const p = r.parts, x = r.x, mU = 0.02 * x * (L - x) / 2, mF = 0.01 * x * (L - x) / 2, f = b.R.flexFull.find(q => q.x === x), p0 = N0[i].parts;
    near(p.ut.hU, -mU, 1e-9, 'hogging UT'); assert.equal(p.ut.gU, mU > 0 ? 0.65 : 0.65); assert.equal(p.ut.gF, 0);
    near(p.hNC, -(f.mSW + f.mDC1 - mU - mF), 1e-9, 'M_DC1 without the utilities'); near(p.hNC, p0.hNC, 1e-6, 'the noncomposite DC as without the rows');
    near(p.D, p.gNC * p.hNC + p.g2 * p.h2 + p.gW * p.hW + 0.65 * -mU + 0, 1e-9, 'factored dead load');
    near(p.D - p0.D, -0.65 * mU, 1e-6, 'only 0.65 M_UT relieves; the allowance does not'); assert.ok(r.inv >= N0[i].inv - 1e-12); });
  // the positive-moment rows: UT with DW (1.50), the allowance with DC (1.25)
  const Pp = A.rows.filter(r => r.kind === 'flexP'), P0 = A0.rows.filter(r => r.kind === 'flexP');
  Pp.forEach((r, i) => { const x = r.x, mU = 0.02 * x * (L - x) / 2, mF = 0.01 * x * (L - x) / 2; near(r.DW - P0[i].DW, mU, 1e-9, 'DW + M_UT'); near(r.DC - P0[i].DC, mF, 1e-9, 'DC + M_UF'); });
  // the shear rows: |V_DW + V_UT|, |V_DC + V_UF|
  A.rows.filter(r => r.kind === 'shear' && r.src === 'grid').slice(0, 5).forEach(r => { const r0 = A0.rows.find(q => q.kind === 'shear' && q.x === r.x), dg = b.R.diagrams.find(q => q.x === r.x), dg0 = a.R.diagrams.find(q => q.x === r.x), v = 0.02 * (L / 2 - r.x);
    near(r.DW, Math.abs(dg0.V_DW + v), 1e-9, 'V_DW'); near(r.DC, Math.abs(dg.V_DC - v), 1e-9, 'V_DC'); assert.ok(r0); });
  // the governing checks include the state with the allowance absent
  assert.ok(b.R.ut.abs && b.R.ut.abs.rows.length >= a.R.checks.length);
  const none = run(W, cont(bridge('aashto', [UTR]))); b.R.ut.abs.rows.forEach(r => assert.ok(Object.is(r.rA, chk(none.R, r.n).r), r.n));
});

test('a negative share (a load outside the exterior girder, two adjacent beams): the utility relieves, γ_UT = 0.65', () => {
  // x = 0.75 ft, 2.25 ft outside G1 (at 3 ft): G1 0.10 (1 + 2.25/9) = 0.125, G2 −0.10 × 2.25 / 9 = −0.025 klf
  const row = { name: 'Conduit', cat: 'UTN', x: 0.75, plf: 0.10, dist: 'two' }, P = bridge('aashto', [row]);
  near(DL.line(P, 1).UTN, 0.125, 1e-12, 'G1'); near(DL.line(P, 2).UTN, -0.025, 1e-12, 'G2');
  const a = run(W, bridge('aashto')), b = run(W, P), q = b.R.ut; assert.equal(b.R.error, null);
  near(q.wUT, -0.025, 1e-12, 'w_UT'); assert.equal(q.gUT, 0.65); near(q.MUT, -45, 1e-9, 'M_UT');
  // Strength I at midspan: 0.65 × (−45) = −29.25 kip-ft (not 1.25 or 1.50 × −45)
  near((b.R.MuMid - a.R.MuMid) / 12, -29.25, 1e-6, 'M_u with the minimum factor');
  // rating: it stays with DC at 0.65 / 1.25 of itself; DW unchanged
  const ra = a.R.rating, rb = b.R.rating, mx = -0.025 * rb.x * (120 - rb.x) / 2; assert.equal(ra.x, rb.x);
  near(rb.MDW, ra.MDW, 1e-9, 'M_DW'); near(1.25 * (rb.MDC - ra.MDC), 0.65 * mx, 1e-6, 'γ M_UT in the rating');
});

test('worked steps: ld.ut.* and every tab\'s steps reproduce the engine\'s values (simple, continuous, with the pedestrian load)', () => {
  const ped = P => { P.xs.dl.swL = { w: 6, t: 9 }; P.xs.dl.ped = 75; return P; };
  const mks = [() => bridge('ridot', [UTR, UFR]), () => cont(bridge('aashto', [UTR, UFR])), () => bridge('massdot', [UTR]), () => bridge('aashto', [UFR]), () => ped(bridge('massdot', [UTR, UFR]))];
  let tot = 0;
  for (const mk of mks) {
    const P = mk(), { i, R } = run(W, P); assert.equal(R.error, null); assert.ok(R.ut);
    const ST = { loads: W.PSBWorked.loads(i, R), analysis: W.PSBWorked.analysis(i, R), losses: W.PSBWorkedStress.losses(i, R), stresses: W.PSBWorkedStress.stresses(i, R), flexure: W.PSBWorkedStrength.flexure(i, R), shear: W.PSBWorkedStrength.shear(i, R),
      endzone: W.PSBWorkedEnd.endzone(i, R), camber: W.PSBWorkedEnd.camber(i, R), rating: W.PSBWorkedHDR.rating(i, R) };
    const at = (o, p) => p.split('.').reduce((q, k) => q == null ? q : q[k], o);
    for (const [tab, r] of Object.entries(ST)) { r.pairs.forEach(p => { tot++; near(p.shown, p.engine, 1e-9 * Math.max(1, Math.abs(p.engine)), `${tab} ${p.id}`); });
      Object.entries(r.paths || {}).forEach(([id, p]) => { const s = r.steps.find(q => q.id === id); assert.ok(Object.is(s.value, at(R, p)), `${tab} ${id}`); }); }
    const ids = ST.loads.steps.map(s => s.id), hasT = R.ut.wUT !== 0, hasF = R.ut.wUF !== 0;
    ['ld.ut.wNC', 'ld.ut.MuU', 'ld.ut.fb', 'ld.ut.ft', 'ld.ut.gain', 'ld.ut.cam'].forEach(id => assert.ok(ids.includes(id), id));
    if (hasT) ['ld.ut.wUT', 'ld.ut.MUT', 'ld.ut.VUT', 'ld.ut.gUT', 'ld.ut.dMu', 'ld.ut.dVu'].forEach(id => assert.ok(ids.includes(id), id)); else assert.ok(!ids.includes('ld.ut.MUT'));
    if (hasF) ['ld.ut.wUF', 'ld.ut.MUF', 'ld.ut.VUF', 'ld.ut.abs'].forEach(id => assert.ok(ids.includes(id), id)); else assert.ok(!ids.includes('ld.ut.abs'));
    near(ST.loads.steps.find(s => s.id === 'ld.ut.wNC').value, i.loads.wNC, 0, 'w_NC step');
    // the Strength I steps show the utility's term, and the steps that take DC1 link to its derivation
    const t = id => Object.values(ST).flatMap(r => r.steps).find(s => s.id === id);
    if (hasT) { ['an.MuS', 'an.VuS', 'fx.Mu', 'sh.Vu'].forEach(id => { assert.match(t(id).eq, /\\gamma_\{UT\} - 1\.25/, id); assert.match(t(id).note, /§ld\.ut\.d[MV]u/, id); }); assert.match(t('rt.MDW').eq, /M_\{UT\}/); }
    else ['an.MuS', 'an.VuS', 'fx.Mu', 'sh.Vu'].forEach(id => assert.doesNotMatch(t(id).eq, /UT/, id));
    assert.match(t('an.Mdc1').note, /§ld\.ut\.wNC/); assert.match(t('cb.dDK').note, hasF ? /§ld\.ut\.cam/ : /§ld\.ut\.wNC/);
    if (hasF) assert.match(t('cb.dDK').eq, /w_\{DC1\} - w_\{UF\}/);
    // the distribution steps of the line
    DL.withSteps(ST.loads, P); const g = D.sel(P).g, s2 = id => ST.loads.steps.find(q => q.id === `dl.G${g}.${id}`);
    if (hasT) near(s2('UTN').value, R.ut.wUT, 1e-15, 'w_UT step'); if (hasF) near(s2('UF').value, R.ut.wUF, 1e-15, 'w_UF step');
    assert.match(ST.loads.steps.find(q => q.id === 'ld.wDC1').note, /§ld\.ut\.wNC/);
    // the rating rows' steps
    const A = W.PSBRatingAlong.of(R); W.PSBRatingAlong.govSteps(A).forEach(s => assert.ok(s.id));
    if (R.pl) { assert.ok(R.pl.Mmid > 0); assert.match(t('fx.Mu').note, /ld\.pl\.MLLPL/); }
  }
  assert.ok(tot > 500, 'pairs ' + tot);
  // the pedestrian load and the utilities together: each adds its own part (the copy of the copy)
  const P1 = ped(bridge('aashto')), P2 = ped(bridge('aashto', [UTR, UFR])), a = run(W, P1), b = run(W, P2);
  near((b.R.MuMid - a.R.MuMid) / 12, 76.5, 1e-6, 'M_u with PL: + 1.50 M_UT + 1.25 M_UF'); near(b.R.pl.Mmid, a.R.pl.Mmid, 0, 'M_PL unchanged');
  // no utility: the steps are those of the app without engine/ut.js
  const P0 = bridge('massdot'), r0 = run(W, P0), z0 = run(W0, W0.PSBModel.importJSON(M.exportJSON(P0)).project);
  for (const f of [['PSBWorked', 'analysis'], ['PSBWorkedStrength', 'flexure'], ['PSBWorkedStrength', 'shear'], ['PSBWorkedEnd', 'camber'], ['PSBWorkedHDR', 'rating'], ['PSBWorked', 'loads']])
    assert.equal(JSON.stringify(W[f[0]][f[1]](r0.i, r0.R).steps), JSON.stringify(W0[f[0]][f[1]](z0.i, z0.R).steps), f.join('.'));
});
