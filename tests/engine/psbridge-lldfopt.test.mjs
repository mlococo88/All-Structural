// apps/ps-bridge LL-O and IMP-N (2026-11-23; fixlog/ps-bridge.md). Made-up bridges.
// LL-O: the two optional live-load distribution options of the bridge (engine/lldf-opt.js window.PSBLldfOpt; P.xs.lldf, the Steel Bridge
// app's names): (a) extMin "Exterior not less than interior", (b) skewV 'ext' "Shear skew correction: Exterior girders only".
//   1. Both off (absent, or 'all' / false): the engine inputs have no "lldf" and every result equals the app loaded without
//      engine/lldf-opt.js (the harness B designs, a new project, a skewed bridge).
//   2. Hand checks of each option, off and on (AASHTO LRFD 10th Ed. 4.6.2.2.2b, 4.6.2.2.2d, 4.6.2.2.3a, 4.6.2.2.3b, 4.6.2.2.3c), equal and
//      unequal bays, both on; what is not changed (the fatigue factor, the moment skew reduction, the other position).
//   3. The whole design with a raised factor = the design with that factor entered (so every check and the rating take the same factor).
//   4. Entered factors, imported live load, two girders, box beams (types f / g keep the correction): no change.
//   5. The worked steps reproduce the engine's values; the applicability check tests S_int; the model accepts / rejects xs.lldf.
// IMP-N: imported demands are used as given (a note only): what is and is not added, the note on the input side, in R.warns and the steps.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const ENG = ['sections', 'model', 'rigid', 'lldf-fg', 'lldf-opt', 'ut', 'pl', 'applicability', 'holddown', 'pierblock', 'rating-along', 'demands', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr'];
const load = list => loadShared('steps.js', ...PBDF, ...list.map(n => path.join(APP, `engine/${n}.js`)));
const W = load(ENG), W0 = load(ENG.filter(n => n !== 'lldf-opt'));
const M = W.PSBModel, D = W.PSBDesign, LO = W.PSBLldfOpt, DM = W.PSBDemands;
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
/* the result of girder line g of a project (its girder type's inputs on that line) */
const cell = (Wx, P, g) => { const B = Wx.PSBBridge, k = P.types.findIndex((t, i) => B.typeLines(P, i).includes(g)); const i = Wx.PSBDesign.cellInputs(P, k, g); return { i, R: Wx.PSBHoldDown.compute(J(i)) }; };
/* the made-up bridge of the hand checks: a new project (one 120 ft span, 5 PCI BT-72 at 9 ft, t_s = 8 in, overhangs 3 ft, barriers 1.5 ft
   wide so d_e = 1.5 ft, 2 lanes) with both supports skewed 30 degrees */
const bridge = (opt, f) => { const P = M.newProject(); P.xs.skews = [30, 30]; if (opt) P.xs.lldf = opt; if (f) f(P); return P; };
const TAN30 = Math.tan(Math.PI / 6);

test('LL-O off (absent, or all / false): no inputs.lldf, and the results of the app without engine/lldf-opt.js (harness B designs, new project, skew)', () => {
  const cases = Object.assign({ newProject: M.newProject(), skewed: bridge(null), unequal: bridge(null, P => { P.xs.bays = [6, 10, 10, 6]; }) }, TAB_CASES(() => M.defaultProject())); let n = 0;
  for (const [name, P0] of Object.entries(cases)) {
    for (const lldf of [undefined, { skewV: 'all', extMin: false }, {}]) {
      const Q = J(P0); if (lldf) Q.xs.lldf = lldf;
      const P = M.importJSON(M.exportJSON(Q)).project, P2 = W0.PSBModel.importJSON(W0.PSBModel.exportJSON(J(P0))).project;
      const i = D.inputs(P), i0 = W0.PSBDesign.inputs(P2);
      assert.ok(!('lldf' in i), name + ': no inputs.lldf'); assert.equal(JSON.stringify(i), JSON.stringify(i0), name + ' inputs');
      assert.equal(text(W.PSBHoldDown.compute(J(i)), i.L), text(W0.PSBHoldDown.compute(J(i0)), i0.L), name + ' result'); n++;
    }
  }
  assert.ok(n >= 60, 'cases ' + n);
  const N = M.newProject(); assert.ok(!('lldf' in N.xs), 'a new project has no xs.lldf (both options off)');
  console.log(`  LL-O: both options off = the app without engine/lldf-opt.js on ${n} design × option-state cases (0 differences)`);
});

test('LL-O (b) shear skew correction on the exterior girders only: interior DF_V = g_V (hand), exterior and moment unchanged', () => {
  const off = cell(W, bridge(null), 2), on = cell(W, bridge({ skewV: 'ext', extMin: false }), 2), df = off.R.df;
  // hand (4.6.2.2.3a, 4.6.2.2.3c): S = 9 ft, L = 120 ft, t_s = 8 in, K_g = 2,229,523 in^4 (the engine's, Loads & LLDF step K_g)
  near(df.Kg, 2229523, 1, 'K_g'); assert.equal(off.i.S, 9); assert.equal(off.i.L, 120); assert.equal(off.i.ts, 8);
  const v1 = 0.36 + 9 / 25, v2 = 0.2 + 9 / 12 - (9 / 35) ** 2, cV = 1 + 0.20 * Math.pow(12 * 120 * 512 / df.Kg, 0.3) * TAN30;
  near(v1, 0.72, 1e-12); near(v2, 0.883878, 1e-6); near(cV, 1.08285, 1e-5, 'c_V');
  near(off.R.dfv, cV * v2, 1e-12, 'off: DF_V = c_V g_V'); near(off.R.dfv, 0.95711, 1e-5);
  near(on.R.dfv, v2, 1e-12, 'on: DF_V = g_V'); near(on.R.dfv, 0.88388, 1e-5);
  near(on.R.VLL, off.R.VLL * v2 / (cV * v2), 1e-9, 'V_LL in proportion'); near(off.R.VLL, 121.28, 0.01); near(on.R.VLL, 112.00, 0.01);
  assert.equal(on.R.dfm, off.R.dfm, 'DF_M unchanged'); assert.equal(on.R.MLL, off.R.MLL); assert.equal(on.R.fat.dfFat, off.R.fat.dfFat, 'fatigue DF unchanged');
  assert.equal(on.R.df.skV, off.R.df.skV, 'the table value stays shown'); assert.equal(on.R.df.opt.cV, 1); assert.equal(on.R.df.opt.skewOff, true); near(on.R.df.opt.dfv0, off.R.dfv, 1e-15);
  assert.deepEqual(J(on.i.lldf), { skewV: 'ext' });
  // the exterior girder keeps the correction: every result as with the option off
  const eOff = cell(W, bridge(null), 1), eOn = cell(W, bridge({ skewV: 'ext' }), 1);
  assert.equal(eOn.R.dfv, eOff.R.dfv); assert.equal(eOn.R.dfm, eOff.R.dfm); assert.equal(eOn.R.VLL, eOff.R.VLL);
  assert.equal(JSON.stringify(eOn.R.checks), JSON.stringify(eOff.R.checks)); assert.equal(eOn.R.df.opt.cV, eOff.R.df.skV);
  // no skew: the option changes nothing
  const z0 = cell(W, bridge(null, P => { P.xs.skews = [0, 0]; }), 2), z1 = cell(W, bridge({ skewV: 'ext' }, P => { P.xs.skews = [0, 0]; }), 2);
  assert.equal(z1.R.dfv, z0.R.dfv); assert.equal(JSON.stringify(z1.R.checks), JSON.stringify(z0.R.checks));
});

test('LL-O (a) exterior not less than interior: DF = max(exterior, interior) (hand), equal and unequal bays; fatigue and interior lines unchanged', () => {
  const off = cell(W, bridge(null), 1), on = cell(W, bridge({ skewV: 'all', extMin: true }), 1), df = off.R.df, Kg = df.Kg;
  // hand, exterior G1 (d_e = 1.5 ft, S = 9 ft, N_b = 5, N_L = 2): lever 1.2 (0.5 (9 − 0.5) / 9 + 0.5 (9 − 6.5) / 9) = 0.7333;
  //   rigid, 2 lanes, m = 1.0: X_ext = 18, Σx² = 810, Σe = 14.5 + 2.5 = 17: 2/5 + 18 (17) / 810 = 0.7778; e_M g_M2 = 0.9348 (0.7191) = 0.6723;
  //   e_V g_V2 = 0.75 (0.8839) = 0.6629  →  g_M = g_V = 0.7778 before skew
  assert.equal(off.i.loads.de, 1.5); assert.equal(off.i.loads.NL, 2);
  const kg = Math.pow(Kg / (12 * 120 * 512), 0.1), m1 = 0.06 + Math.pow(9 / 14, 0.4) * Math.pow(9 / 120, 0.3) * kg, m2 = 0.075 + Math.pow(9 / 9.5, 0.6) * Math.pow(9 / 120, 0.2) * kg;
  const v2 = 0.2 + 9 / 12 - (9 / 35) ** 2, lever = 1.2 * (0.5 * 8.5 / 9 + 0.5 * 2.5 / 9), rigid = 1.0 * (2 / 5 + 18 * 17 / 810);
  near(m1, 0.49035, 1e-5); near(m2, 0.71914, 1e-5); near(lever, 0.73333, 1e-5); near(rigid, 0.77778, 1e-5);
  const c1 = 0.25 * Math.pow(Kg / (12 * 120 * 512), 0.25) * Math.pow(9 / 120, 0.5), rM = 1 - c1 * Math.pow(TAN30, 1.5), cV = 1 + 0.20 * Math.pow(12 * 120 * 512 / Kg, 0.3) * TAN30;
  near(rM, 0.96039, 1e-5); near(cV, 1.08285, 1e-5);
  const eM = 0.77 + 1.5 / 9.1, eV = 0.6 + 1.5 / 10, gE = Math.max(eM * m2, lever, rigid), gEv = Math.max(eV * v2, lever, rigid);
  const dfmE = rM * gE, dfvE = cV * gEv, dfmI = rM * Math.max(m1, m2), dfvI = cV * Math.max(0.36 + 9 / 25, v2);
  near(dfmE, 0.74697, 1e-5); near(dfvE, 0.84222, 1e-5); near(dfmI, 0.69066, 1e-5); near(dfvI, 0.95711, 1e-5);
  near(off.R.dfm, dfmE, 1e-12, 'off DF_M'); near(off.R.dfv, dfvE, 1e-12, 'off DF_V');
  near(on.R.dfm, Math.max(dfmE, dfmI), 1e-12, 'on DF_M = max'); near(on.R.dfv, Math.max(dfvE, dfvI), 1e-12, 'on DF_V = max');
  assert.equal(on.R.dfm, off.R.dfm, 'DF_M: the exterior factor governs, unchanged'); near(on.R.dfv, 0.95711, 1e-5, 'DF_V raised to interior');
  assert.equal(on.R.df.opt.policyV, true); assert.ok(!on.R.df.opt.policyM); assert.deepEqual(J(on.i.lldf), { extMin: true, Sint: 9 });
  near(off.R.VLL, 106.72, 0.01); near(on.R.VLL, 121.28, 0.01); assert.equal(on.R.MLL, off.R.MLL);
  assert.equal(on.R.fat.dfFat, off.R.fat.dfFat, 'the fatigue factor is not raised'); near(on.R.fat.dfFat, lever / 1.2, 1e-12);
  // the interior girder of the same bridge: nothing changes (and its DF_V is what the exterior was raised to)
  const iOff = cell(W, bridge(null), 2), iOn = cell(W, bridge({ extMin: true }), 2);
  assert.equal(JSON.stringify(iOn.R.checks), JSON.stringify(iOff.R.checks)); assert.equal(iOn.R.dfv, iOff.R.dfv); near(on.R.dfv, iOff.R.dfv, 1e-12, 'exterior = interior DF_V');
  // unequal bays 6, 10, 10, 6 ft: the exterior line has S = 6 ft; the interior lines S = 8, 10, 8 ft → S_int = 10 ft
  const U = f => bridge(f, P => { P.xs.bays = [6, 10, 10, 6]; }), uOff = cell(W, U(null), 1), uOn = cell(W, U({ extMin: true }), 1);
  assert.deepEqual(J(uOn.i.lldf), { extMin: true, Sint: 10 }); assert.equal(uOn.i.S, 6);
  const m1u = 0.06 + Math.pow(10 / 14, 0.4) * Math.pow(10 / 120, 0.3) * kg, m2u = 0.075 + Math.pow(10 / 9.5, 0.6) * Math.pow(10 / 120, 0.2) * kg, v2u = 0.2 + 10 / 12 - (10 / 35) ** 2;
  const rMu = 1 - 0.25 * Math.pow(Kg / (12 * 120 * 512), 0.25) * Math.pow(10 / 120, 0.5) * Math.pow(TAN30, 1.5);
  near(m2u, 0.77579, 1e-5); near(v2u, 0.95170, 1e-5); near(rMu, 0.95825, 1e-5);
  near(uOff.R.dfm, 0.66983, 1e-4); near(uOff.R.dfv, 0.74947, 1e-4);
  near(uOn.R.dfm, rMu * Math.max(m1u, m2u), 1e-12, 'unequal DF_M'); near(uOn.R.dfv, cV * v2u, 1e-12, 'unequal DF_V'); near(uOn.R.dfm, 0.74340, 1e-5); near(uOn.R.dfv, 1.03055, 1e-5);
  assert.equal(uOn.R.df.opt.policyM, true); assert.equal(uOn.R.df.opt.policyV, true); assert.equal(uOn.R.fat.dfFat, uOff.R.fat.dfFat);
  assert.ok(uOn.R.df.rigidX, 'the rigid section on the real girder lines (PS-19) is kept'); assert.equal(uOn.R.df.rigid, uOff.R.df.rigid);
  // two girders: no interior line, nothing changes
  const two = f => bridge(f, P => { P.xs.nb = 2; P.xs.bays = [9]; P.types = W.PSBBridge.newTypes(P); }), tOff = cell(W, two(null), 1), tOn = cell(W, two({ extMin: true }), 1);
  assert.equal(tOn.R.dfm, tOff.R.dfm); assert.equal(tOn.R.dfv, tOff.R.dfv); assert.ok(!tOn.R.df.opt.int); assert.deepEqual(J(tOn.i.lldf), { extMin: true });
});

test('LL-O both on: the interior factor the exterior is compared with has no shear skew correction', () => {
  const on = cell(W, bridge({ skewV: 'ext', extMin: true }), 1), off = cell(W, bridge(null), 1), v2 = 0.2 + 9 / 12 - (9 / 35) ** 2;
  near(on.R.dfv, Math.max(off.R.dfv, v2), 1e-12); near(on.R.dfv, 0.88388, 1e-5); assert.equal(on.R.dfm, off.R.dfm);
  near(on.R.df.opt.int.skV, 1, 0); near(on.R.df.opt.int.skVtab, off.R.df.skV, 1e-15);
  const i2 = cell(W, bridge({ skewV: 'ext', extMin: true }), 2); near(i2.R.dfv, v2, 1e-12);
  // with a pedestrian load and a noncomposite utility (the engine copies of engine/pl.js and engine/ut.js): the same factors
  const pu = P => { P.xs.dl.swL = { w: 6, t: 9 }; P.xs.dl.ped = 75; P.xs.dl.extra = [{ name: 'Gas main', cat: 'UTN', x: 16.5, plf: 0.10 }]; };
  const q1 = cell(W, bridge({ skewV: 'ext', extMin: true }, pu), 1), q0 = cell(W, bridge(null, pu), 1);
  assert.ok(q1.R.pl && q1.R.ut, 'the pedestrian load and the utility are in the run'); near(q1.R.dfv, Math.max(q0.R.dfv, v2), 1e-12, 'DF_V with PL and UT'); assert.equal(q1.R.dfm, q0.R.dfm);
});

test('LL-O: the design with a raised factor = the design with that factor entered (every check and the rating take the same factor)', () => {
  const P = bridge({ skewV: 'all', extMin: true }, Q => { Q.xs.bays = [6, 10, 10, 6]; }), on = cell(W, P, 1), off = cell(W, bridge(null, Q => { Q.xs.bays = [6, 10, 10, 6]; }), 1);
  assert.notEqual(on.R.dfm, off.R.dfm);
  const man = J(off.i); man.loads.dfAuto = false; man.loads.dfm = on.R.dfm; man.loads.dfv = on.R.dfv; man.loads.fatM = off.R.fat.dfFat;
  const Rm = W.PSBHoldDown.compute(man), drop = c => c.filter(q => q.n !== W.PSBApplic.NAME);
  assert.equal(JSON.stringify(drop(on.R.checks)), JSON.stringify(drop(Rm.checks)), 'every check');
  ['rating', 'svcRating', 'shrRating', 'vehRatings'].forEach(k => assert.equal(text(on.R[k], 120), text(Rm[k], 120), k));
  assert.equal(on.R.MLL, Rm.MLL); assert.equal(on.R.VLL, Rm.VLL);
  assert.notEqual(JSON.stringify(on.R.rating), JSON.stringify(off.R.rating), 'the rating moved with the factor');
});

test('LL-O: entered factors, imported live load and box beams (types f / g) are not changed', () => {
  // entered distribution factors
  const E = f => bridge(f, P => { P.base.loads.dfAuto = false; P.base.loads.dfm = 0.7; P.base.loads.dfv = 0.8; });
  for (const g of [1, 2]) { const a = cell(W, E(null), g), b = cell(W, E({ skewV: 'ext', extMin: true }), g); assert.equal(text(b.R, 120), text(a.R, 120), 'entered G' + g); assert.ok(!b.R.df.opt); }
  // imported live load (a custom table)
  const T = f => bridge(f, P => { P.types.forEach(t => { DM.setSrc(P, t.id, 'table'); DM.setTable(P, t.id, [{ x: 0, V_LLneg: -90 }, { x: 60, M_LLpos: 2400, M_DC2: 300, M_DW: 200 }, { x: 120, V_LLpos: 90 }]); }); });
  for (const g of [1, 2]) { const a = cell(W, T(null), g), b = cell(W, T({ skewV: 'ext', extMin: true }), g); assert.ok(a.R.useExt, 'imported'); assert.ok(!b.R.df.opt);
    assert.equal(JSON.stringify(b.R.checks), JSON.stringify(a.R.checks), 'imported G' + g); assert.equal(b.R.dfv, a.R.dfv); }
  // adjacent box beams (type g): the shear skew correction stays on an interior beam with "Exterior girders only"
  const box = f => { const P = M.newProject(); P.base.girder = 'AASHTO BI-36 (27in)'; P.base.ts = 0; P.base.harp.n = 0; P.base.rows = [{ n: 10, y: 2, nd: 0, dbnd: 0 }]; P.xs.bays = [3, 3, 3, 3]; P.xs.ohL = P.xs.ohR = 1.5; P.spans.lengths = [60]; P.xs.skews = [25, 25]; if (f) P.xs.lldf = f; return P; };
  const b0 = cell(W, box(null), 2), b1 = cell(W, box({ skewV: 'ext' }), 2);
  assert.ok(b0.R.df.fg && b0.R.df.skV > 1); assert.equal(b1.R.dfv, b0.R.dfv); assert.equal(b1.R.df.opt.fgKeep, true); assert.equal(b1.R.df.opt.cV, b0.R.df.skV);
  assert.equal(JSON.stringify(b1.R.checks), JSON.stringify(b0.R.checks));
  // box beams with "exterior not less than interior": max of the type (g) exterior and interior factors
  const x0 = cell(W, box(null), 1), x1 = cell(W, box({ extMin: true }), 1), xi = cell(W, box(null), 2);
  near(x1.R.dfm, Math.max(x0.R.dfm, xi.R.dfm), 1e-12, 'box DF_M'); near(x1.R.dfv, Math.max(x0.R.dfv, xi.R.dfv), 1e-12, 'box DF_V');
});

test('LL-O: the worked steps reproduce the engine (ld.lo.*, ld.dfm, ld.dfv); the applicability check tests S_int; the texts', () => {
  let n = 0;
  for (const [opt, bays, g] of [[{ skewV: 'ext' }, [9, 9, 9, 9], 2], [{ skewV: 'ext' }, [9, 9, 9, 9], 1], [{ extMin: true }, [9, 9, 9, 9], 1], [{ extMin: true }, [6, 10, 10, 6], 1], [{ skewV: 'ext', extMin: true }, [6, 10, 10, 6], 1], [{ extMin: true }, [9, 9, 9, 9], 2]]) {
    const c = cell(W, bridge(opt, P => { P.xs.bays = bays; }), g), K = W.PSBWorked.loads(c.i, c.R), ids = K.steps.map(s => s.id);
    assert.ok(ids.some(id => /^ld\.lo\./.test(id)), 'ld.lo.* steps'); assert.ok(ids.indexOf('ld.dfm') > ids.findIndex(id => /^ld\.lo\./.test(id)), 'before the factors used');
    K.pairs.forEach(p => { if (/^ld\.(lo\.|dfm$|dfv$)/.test(p.id)) { n++; near(p.shown, p.engine, 1e-9, p.id); } });
    const sv = K.steps.find(s => s.id === 'ld.dfv'), sm = K.steps.find(s => s.id === 'ld.dfm'); near(sv.value, c.R.dfv, 0); near(sm.value, c.R.dfm, 0);
  }
  assert.ok(n >= 20, 'pairs ' + n);
  // off: no ld.lo.* step, the two factor steps as before
  const o = cell(W, bridge(null), 1), K0 = W.PSBWorked.loads(o.i, o.R); assert.ok(!K0.steps.some(s => /^ld\.lo\./.test(s.id))); assert.equal(K0.steps.find(s => s.id === 'ld.dfv').eq, 'c_{V}\\,g_{V}');
  // the applicability check (AP-B): S_int tested when it differs from the line's S; outside 3.5 to 16.0 ft it fails
  const a = cell(W, bridge({ extMin: true }, P => { P.xs.bays = [6, 10, 10, 6]; }), 1).R.ap; const it = a.items.find(q => q.key === 'Sint'); assert.ok(it && it.ok && it.value === 10);
  assert.ok(!cell(W, bridge({ extMin: true }), 1).R.ap.items.some(q => q.key === 'Sint'), 'equal bays: no extra item');
  const big = cell(W, bridge({ extMin: true }, P => { P.xs.bays = [8, 17, 17, 8]; }), 1).R; assert.equal(big.ap.items.find(q => q.key === 'Sint').ok, false); assert.equal(big.ap.level, 'fail');
  assert.ok(big.checks.some(q => q.n === W.PSBApplic.NAME && !q.pass));
  // the Steel Bridge app's wording, and the method text
  assert.equal(LO.TXT.skewV, 'Shear skew correction'); assert.equal(LO.TXT.ext, 'Exterior girders only'); assert.equal(LO.TXT.all, 'All girders'); assert.equal(LO.TXT.extMin, 'Exterior not less than interior');
  assert.match(LO.label(cell(W, bridge({ extMin: true }), 1).R), /DF_V raised to interior \(policy\)/); assert.equal(LO.label(o.R), '');
});

test('LL-O: the saved project: xs.lldf optional, validated, kept through export / import', () => {
  const P = bridge({ skewV: 'ext', extMin: true }), s = M.exportJSON(P), Q = M.importJSON(s).project;
  assert.deepEqual(J(Q.xs.lldf), { skewV: 'ext', extMin: true }); assert.equal(M.exportJSON(Q), s);
  assert.equal(M.validate(P).errors.filter(e => /lldf/.test(e.path)).length, 0);
  const bad = bridge({ skewV: 'some', extMin: 'yes' }); assert.equal(M.validate(bad).errors.filter(e => /^xs\.lldf\./.test(e.path)).length, 2);
  const N = M.newProject(), t = M.exportJSON(N); assert.ok(!/"lldf"/.test(t), 'a new project stores no xs.lldf'); assert.equal(M.exportJSON(M.importJSON(t).project), t);
});

test('IMP-N: imported demands are used as given: PL and a composite utility are not added (note only), noncomposite utilities are', () => {
  const rows = [{ x: 0, V_LLneg: -90 }, { x: 60, M_LLpos: 2400, M_DC2: 300, M_DW: 200 }, { x: 120, V_LLpos: 90 }];
  const mk = f => { const P = M.newProject(); P.xs.dl.swL = { w: 6, t: 9 }; P.types.forEach(t => { DM.setSrc(P, t.id, 'table'); DM.setTable(P, t.id, rows); }); if (f) f(P); return P; };
  // no pedestrian load, no utility: no note, no R.imp
  const a = cell(W, mk(), 1); assert.ok(a.R.useExt); assert.ok(!a.R.imp); assert.ok(!DM.checks(mk()).warnings.some(w => /used as given/.test(w.msg)));
  // a pedestrian load: not added (every check as without it), one note in R.warns (not the old text twice), the input warning, the step
  const Pp = mk(P => { P.xs.dl.ped = 75; }), b = cell(W, Pp, 1);
  assert.ok(b.i.pl && b.i.pl.w > 0); assert.equal(JSON.stringify(b.R.checks), JSON.stringify(a.R.checks), 'PL changes no check with imported demands');
  assert.equal(b.R.MLL, a.R.MLL); assert.equal(b.R.VLL, a.R.VLL);
  assert.ok(b.R.imp && b.R.imp.pl === b.i.pl.w && !b.R.imp.utc); const wn = b.R.warns.filter(w => /pedestrian/i.test(w)); assert.equal(wn.length, 1);
  assert.match(wn[0], /used as given/); assert.match(wn[0], /imported live load must already include it; it is NOT added by this app \(AASHTO LRFD 10th Ed\. 3\.6\.1\.6\)/);
  assert.ok(!b.R.warns.includes(W.PSBPL.WARN_EXT));
  const iw = DM.checks(Pp).warnings.filter(w => /used as given/.test(w.msg)); assert.ok(iw.length >= 1); assert.match(iw[0].msg, /pedestrian live load is entered/);
  const st = W.PSBWorked.loads(b.i, b.R).steps; assert.ok(st.some(s => s.id === 'ld.imp' && /NOT added/.test(s.note))); assert.ok(st.some(s => s.id === 'ld.pl.ext'));
  // a composite utility (category UT, in the line's DW): the imported DW is used, so it is not added: noted
  const Pu = mk(P => { P.xs.dl.extra = [{ name: 'Water main', cat: 'UT', x: 16.5, plf: 0.06 }]; }), c = cell(W, Pu, 1);
  assert.ok(c.i.imp && c.i.imp.utc > 0); assert.ok(c.R.imp && c.R.imp.utc > 0 && !c.R.imp.pl);
  assert.equal(JSON.stringify(c.R.checks.map(q => [q.n, q.pass])), JSON.stringify(a.R.checks.map(q => [q.n, q.pass])));
  const fm = R => R.grid.reduce((p, r) => Math.abs(r.x - 60) < Math.abs(p.x - 60) ? r : p);
  near(fm(c.R).Mu, fm(a.R).Mu, 1e-9, 'M_u at midspan (kip-in): the composite utility is not added to the imported DW');
  assert.match(c.R.warns.find(w => /used as given/.test(w)), /utility on the composite section .* imported DW must already include it/);
  // a noncomposite utility and the future allowance: this app's DC1 stage, so they ARE applied with imported demands
  const Pn = mk(P => { P.xs.dl.ped = 75; P.xs.dl.extra = [{ name: 'Gas main', cat: 'UTN', x: 16.5, plf: 0.10 }]; }), d = cell(W, Pn, 2), d0 = cell(W, Pp, 2);
  assert.ok(d.i.ut && d.i.ut.wUT > 0); assert.ok(fm(d.R).Mu > fm(d0.R).Mu + 12, 'UTN raises M_u (kip-in) with imported demands');
  near((fm(d.R).Mu - fm(d0.R).Mu) / 12, 1.5 * d.i.ut.wUT * fm(d.R).x * (120 - fm(d.R).x) / 2, 0.5, 'by 1.50 M_UT');
  assert.match(d.R.imp.text, /noncomposite section .* ARE applied by this app/);
  // a type on this app's own analysis: nothing
  const Q = M.newProject(); Q.xs.dl.swL = { w: 6, t: 9 }; Q.xs.dl.ped = 75; const e = cell(W, Q, 1); assert.ok(!e.R.imp); assert.ok(!e.i.imp);
});
