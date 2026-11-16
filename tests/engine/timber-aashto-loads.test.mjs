// "Timber Beam Check.html", AASHTO LRFD 10th Ed. (2024) mode, phase T2 (fix log TBA2, 2026-11-16): bridge loads on one stringer
// (tbcAasLoads in the tool's engine, tbc-source.mjs). Hand checks of the fix log: dead loads (Table 3.5.1-1), live-load distribution
// (Table 4.6.2.2.2a-1, Table 4.6.2.2.2b-1, the lever rule with Table 3.6.1.1.2-1), number of lanes (Art. 3.6.1.1.1), IM for wood
// (Art. 3.6.2.3), load factors (Tables 3.4.1-1, 3.4.1-2), saved data (version 5, sanitizing).
import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { tbcEngine } from './tbc-source.mjs';

const E = tbcEngine();
const J = v => JSON.parse(JSON.stringify(v));
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (±${tol})`);
// 6x16 DF-L No. 1 (5.5 x 15.5 in.) at s = 24 in., 4 in. plank deck, 24 ft roadway (the defaults), plus fn(m)
const run = (fn) => { const m = E.tbcDefaultModel(); m.design.code = 'AASHTO'; m.design.aashto = E.tbcAashtoDefaults(); m.design.aashto.gr = 'No.1'; m.material.size = '6x16'; m.geom.spacing = 24;
  m.design.aashto.bl = E.tbcAasLoadDefaults(); fn && fn(m); const A = E.tbcAashto(m); return { m, A, L: E.tbcAasLoads(m, A) }; };

test('tables: unit weights, deck rows, multiple presence, HL-93, load factors', () => {
  assert.deepEqual(J(E.AAS_UW), { soft: 0.050, hard: 0.060, bit: 0.140, conc: 0.145, rcAdd: 0.005 }, 'Table 3.5.1-1 (kcf) and C3.5.1');
  assert.deepEqual(J(E.AAS_BDECKS.map(d => d.slice(2, 5))), [[6.7, 7.5, 5.0], [9.2, 9.0, 6.0], [8.3, 8.5, 6.0], [10.0, 10.0, 6.0], [12.0, 10.0, 6.0]], 'Table 4.6.2.2.2a-1 (S/k one lane, two or more, S limit) and Table 4.6.2.2.2b-1 (concrete deck on wood beams)');
  assert.deepEqual(J(E.AAS_MPF), [1.20, 1.00, 0.85, 0.65], 'Table 3.6.1.1.2-1');
  assert.deepEqual(J(E.AAS_HL93), { truck: [[8, 0], [32, 14], [32, 14]], sMin: 14, sMax: 30, tandem: [[25, 0], [25, 4]], lane: 0.64, gap2: 50, f2: 0.90, wheel: 6 }, 'Art. 3.6.1.2.2 to 3.6.1.2.4, 3.6.1.3.1');
  assert.deepEqual(J(E.AAS_GP), { DC: [1.25, 0.90], DW: [1.50, 0.65] }, 'Table 3.4.1-2');
  assert.deepEqual(J(E.AAS_COMBOS.map(c => [c[0], c[2], c[3]])), [['StrI', 1.75, 0.8], ['StrII', 1.35, 1.0], ['SerI', 1.00, null]], 'Table 3.4.1-1 gamma_LL; Table 8.4.4.9-1 C_lambda');
  assert.deepEqual([1, 12, 19.9, 20, 24, 24.1, 36, 47.9].map(E.aasLanes), [1, 1, 1, 2, 2, 2, 3, 3], 'Art. 3.6.1.1.1');
});

test('hand check A: dead loads, 6x16 DF-L, 4 in. plank deck, 2 in. bituminous, rail 0.05 kip/ft, S = 2 ft', () => {
  const { L } = run(m => { Object.assign(m.design.aashto.bl, { tWs: 2, wRail: 0.05 }); });
  assert.ok(L.ok, L.errors.join('; '));
  // self-weight 0.050 x 5.5 x 15.5 / 144 = 0.050 x 0.592014 = 0.0296007 kip/ft; deck 0.050 x 4/12 x 2 = 0.033333; WS 0.140 x 2/12 x 2 = 0.046667
  close(L.rows[0].w, 0.050 * 5.5 * 15.5 / 144, 1e-12, 'w_s'); close(L.rows[0].w, 0.0296007, 1e-7, 'w_s by hand');
  close(L.rows[1].w, 0.0333333, 1e-7, 'w_D'); close(L.rows[3].w, 0.0466667, 1e-7, 'w_ws');
  close(L.wDC, 0.0296007 + 0.0333333 + 0.05, 1e-7, 'w_DC = 0.112934'); close(L.wDW, 0.0466667, 1e-7, 'w_DW');
  assert.equal(L.trib, 2); assert.equal(L.tribSrc, 'S');
  // hardwood: 0.060
  const H = run(m => { m.design.aashto.sp = 'NRO'; m.design.aashto.gr = 'No.1'; }).L; close(H.rows[0].w, 0.060 * 5.5 * 15.5 / 144, 1e-12, 'hardwood self-weight');
  // concrete deck: 0.150 kcf
  const C = run(m => { m.geom.spacing = 60; Object.assign(m.design.aashto.bl, { deck: 'concrete', tD: 7 }); }).L; close(C.rows[1].w, 0.150 * 7 / 12 * 5, 1e-12, 'concrete deck 0.4375 kip/ft');
});

test('hand check B: distribution factors (Table 4.6.2.2.2a-1, plank deck, S = 2 ft) and IM for wood', () => {
  const { L } = run();
  // g1 = S/6.7 = 2/6.7 = 0.298507; g2 = S/7.5 = 0.266667; N_L = 2 (24 ft) -> g_M = max = 0.298507; g_V the same table; wood shear rule flagged
  close(L.df.g1, 0.298507, 1e-6, 'g1'); close(L.df.g2, 0.266667, 1e-6, 'g2'); close(L.df.gM, 0.298507, 1e-6, 'gM'); close(L.df.gV, 0.298507, 1e-6, 'gV');
  assert.equal(L.NL, 2); assert.equal(L.df.woodV, true); assert.equal(L.df.srcM, 'table');
  assert.equal(L.im, 0); assert.equal(L.IMf, 1, 'Art. 3.6.2.3: IM need not be applied to wood components');
  // one lane only (w = 18 ft): g_M = g1
  close(run(m => { m.design.aashto.bl.wRd = 18; }).L.df.gM, 2 / 6.7, 1e-12, 'one lane');
  // stressed laminated S = 4 ft: 4/9.2 = 0.434783, 4/9.0 = 0.444444 -> 0.444444
  close(run(m => { m.geom.spacing = 48; m.design.aashto.bl.deck = 'stressed'; }).L.df.gM, 4 / 9.0, 1e-12, 'stressed laminated');
  // deflection: N_b = 12, 2 lanes, m = 1.0: 2/12 = 0.166667
  close(run(m => { m.design.aashto.bl.nB = 12; }).L.df.gD, 2 / 12, 1e-12, 'g_Delta = m NL / Nb');
  close(run().L.df.gD, 2 / 6.7, 1e-12, 'g_Delta without N_b = g_M');
  close(run(m => { m.design.aashto.bl.im = 33; }).L.IMf, 1.33, 1e-12, 'entered IM');
});

test('hand check C: lever rule (exterior; interior beyond the range; concrete deck shear)', () => {
  // exterior, S = 2 ft, d_e = 1.5 ft: outer wheel at x = 1.5 - 2 = -0.5 ft, r = 1 - 0.5/2 = 0.75; inner wheel at -6.5 (beyond -S): 0.
  // one lane: g = 1.20 x 0.75 / 2 = 0.45; two lanes: 1.00 x 0.75 / 2 = 0.375 -> g = 0.45
  const X = run(m => { Object.assign(m.design.aashto.bl, { pos: 'ext', de: 1.5 }); }).L;
  close(X.df.gM, 0.45, 1e-12, 'exterior g'); assert.equal(X.df.srcM, 'lever'); assert.equal(X.df.woodV, false); close(X.trib, 2 / 2 + 1.5, 1e-12, 'exterior tributary width S/2 + de');
  // interior plank, S = 6 ft > 5.0 ft: lever. One lane: wheel over the stringer (1.0) + wheel at 6 ft (0): 1.2 x 1.0 / 2 = 0.60.
  // Two lanes: wheels at -4, 0 (lane 2) and ... best: x = [-10, -4, 0, 6] -> 0 + 0.3333 + 1 + 0 = 1.3333; 1.0 x 1.3333 / 2 = 0.6667
  const P = run(m => { m.geom.spacing = 72; }).L;
  assert.equal(P.df.srcM, 'lever'); close(P.df.lev.cases[0].g, 0.6, 1e-12, 'one lane'); close(P.df.lev.cases[1].g, 2 / 3, 1e-12, 'two lanes'); close(P.df.gM, 2 / 3, 1e-12, 'g');
  // concrete deck on wood beams, S = 6 ft: moment S/12 = 0.5, S/10 = 0.6 -> 0.6 (Table 4.6.2.2.2b-1); shear: lever rule 0.6667 (Table 4.6.2.2.3a-1)
  const C = run(m => { m.geom.spacing = 72; Object.assign(m.design.aashto.bl, { deck: 'concrete', tD: 8 }); }).L;
  close(C.df.gM, 0.6, 1e-12, 'concrete moment'); close(C.df.gV, 2 / 3, 1e-12, 'concrete shear lever'); assert.equal(C.df.woodV, false);
  // glued laminated panels on a sawn stringer: not in the table -> lever
  assert.equal(run(m => { m.design.aashto.bl.deck = 'glpanel'; }).L.df.srcM, 'lever');
  // entered
  const N = run(m => { Object.assign(m.design.aashto.bl, { dfMode: 'entered', gM: 0.35, gV: 0.4 }); }).L; assert.equal(N.df.gM, 0.35); assert.equal(N.df.gV, 0.4);
});

test('input errors and their input tabs', () => {
  const has = (L, re, tab) => { assert.ok(!L.ok); const i = L.errors.findIndex(e => re.test(e)); assert.ok(i >= 0, L.errors.join('; ')); assert.equal(L.errTab[i], tab); };
  has(run(m => { m.geom.spacing = 0; }).L, /spacing/, 'geom');
  has(run(m => { m.design.aashto.bl.tD = -1; }).L, /Deck thickness/, 'loads');
  has(run(m => { m.design.aashto.bl.dfMode = 'entered'; }).L, /Entered distribution/, 'loads');
  has(run(m => { m.design.aashto.bl.nB = 2.5; }).L, /N_b/, 'loads');
  has(run(m => { m.design.aashto.bl.im = -5; }).L, /IM/, 'loads');
  assert.ok(!run(m => { m.material.type = 'scl'; }).L.ok, 'no section: no loads');
});

test('saved data: design.aashto.bl / moist / ndsMoist optional; version 5 only with them', () => {
  const m = E.tbcDefaultModel(); m.design.code = 'AASHTO'; m.design.aashto = E.tbcAashtoDefaults();
  assert.equal(E.tbcVersionFor(m), 4, 'AASHTO without bridge loads: 4 (as TBA1)');
  m.design.aashto.bl = E.tbcAasLoadDefaults(); assert.equal(E.tbcVersionFor(m), 5, 'with bridge loads: 5');
  delete m.design.aashto.bl; m.design.aashto.ndsMoist = 'Dry'; assert.equal(E.tbcVersionFor(m), 5, 'with the kept NDS setting: 5');
  const nds = E.tbcDefaultModel(); nds.design.aashto = Object.assign(E.tbcAashtoDefaults(), { moist: 'Wet', bl: E.tbcAasLoadDefaults() }); assert.equal(E.tbcVersionFor(nds), 2, 'NDS project: 2 / 3 as before');
  const saved = JSON.parse(JSON.stringify(Object.assign(E.tbcDefaultModel(), { version: 5 })));
  saved.design.code = 'AASHTO'; saved.design.aashto = { sp: 'DF-L', gr: 'No.2', gl: '24F-V4 DF/DF', deck: 'none', noTL: false, ndsMoist: 'Dry', moist: 'x', bl: { deck: 'spike', tD: 5, gW: null, pos: 'nowhere', im: 'a', extra: 1 } };
  const r = E.tbcMigrate(saved).model;
  assert.equal(r.version, 5); assert.equal(r.design.aashto.ndsMoist, 'Dry'); assert.ok(!('moist' in r.design.aashto), 'invalid moist dropped');
  assert.equal(r.design.aashto.bl.deck, 'spike'); assert.equal(r.design.aashto.bl.tD, 5); assert.equal(r.design.aashto.bl.gW, null); assert.equal(r.design.aashto.bl.pos, 'int'); assert.equal(r.design.aashto.bl.im, 0); assert.ok(!('extra' in r.design.aashto.bl));
  const t1 = E.tbcMigrate(JSON.parse(JSON.stringify(Object.assign(E.tbcDefaultModel(), { version: 4, design: Object.assign(E.tbcDefaultModel().design, { code: 'AASHTO', aashto: E.tbcAashtoDefaults() }) })))).model;
  assert.ok(!('bl' in t1.design.aashto) && !('ndsMoist' in t1.design.aashto) && t1.design.moisture === 'Dry' && t1.version === 4, 'a TBA1 project opens unchanged (dry as saved, no new fields)');
  assert.throws(() => E.tbcMigrate({ _schema: 'timber-beam-check', version: 6 }), /newer format/);
});
