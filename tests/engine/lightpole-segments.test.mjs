// "Light Pole and Sign Post.html" LPSG (2026-11-19, engineer: the mast wind "should be more simple than that"): the mast wind per pole
// segment, the pole's own 10 segments (L_i = H/10), q_z, D and t_d at each segment mid-height z_i, F_i = q_z K_d·G·C_f·D·L_i at z_i,
// M = ΣF_i z_i (was 100 strips). Hand check on the default pole; within a segment the load is uniform for a cut (lppSegPart); the
// LRFDLTS engine (apps/light-pole/lts-engine.js windForces / sectionWind) takes the same 10 segments.
import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { lpEngine, lpDefaultInp } from './lp-source.mjs';
import { ltsEngine } from './lightpole-lts.test.mjs';

const near = (a, b, abs, what) => assert.ok(Math.abs(a - b) <= abs, `${what}: ${a} vs ${b} (±${abs})`);

/* Default pole: H 35 ft, D 6 in (top) → 10 in (base), Exposure C, V 115 mph, K_zt 1.0, K_d 1.0, G 0.85, C_f 0.7.
   L_i = 3.5 ft. Segment 10 (base): z = 1.75 ft → K_z at 15 ft = 2.01(15/900)^(2/9.5) = 0.8489; q_zK_d = 0.00256·0.8489·115² = 28.740 psf;
   D = 6 + 4(35 − 1.75)/35 = 9.8 in; F = 28.740·0.85·0.7·(9.8/12)·3.5 = 48.878 lb; M = 48.878·1.75 = 85.54 lb·ft.
   Segment 1 (top): z = 33.25 ft → K_z = 2.01(33.25/900)^(2/9.5) = 1.0038; q_zK_d = 33.983 psf; D = 6.2 in; F = 36.564 lb; M = 1,215.77 lb·ft.
   Σ: F_pole = 420.02 lb (100 strips: 420.03), M_pole = 6,984.5 lb·ft (100 strips: 6,980.2), z̄ = 16.63 ft (16.62). */
test('LPSG: default pole, 10 segments of 3.5 ft: F_10 = 48.878 lb at 1.75 ft, F_1 = 36.564 lb at 33.25 ft; ΣF 420.02 lb, ΣFz 6,984.5 lb·ft', () => {
  const lp = lpEngine(), inp = lpDefaultInp(), pw = lp.call('poleWindNominal', inp);
  assert.equal(pw.strips.length, 10); assert.equal(pw.NSTRIP, 10);
  const s0 = pw.strips[0], s9 = pw.strips[9];
  near(s0.z, 1.75, 1e-12, 'z_10'); near(s0.L, 3.5, 1e-12, 'L'); near(s0.w_in, 9.8, 1e-12, 'D_10'); near(s0.Kz, 0.8489, 5e-5, 'K_z(15)');
  near(s0.F, 0.00256 * s0.Kz * 115 * 115 * 0.85 * 0.7 * (9.8 / 12) * 3.5, 1e-9, 'F_10 formula'); near(s0.F, 48.878, 0.001, 'F_10');
  near(s9.z, 33.25, 1e-12, 'z_1'); near(s9.w_in, 6.2, 1e-12, 'D_1'); near(s9.Kz, 1.0038, 5e-5, 'K_z(33.25)'); near(s9.F, 36.564, 0.001, 'F_1');
  near(pw.Fpole, pw.strips.reduce((a, s) => a + s.F, 0), 1e-9, 'ΣF'); near(pw.Mpole, pw.strips.reduce((a, s) => a + s.F * s.z, 0), 1e-9, 'ΣFz');
  near(pw.Fpole, 420.02, 0.01, 'F_pole (was 420.03)'); near(pw.Mpole, 6984.5, 0.1, 'M_pole (was 6,980.2)');
  // iced: width D + 2t_d at V_ice, t_d at z_i (uniform basis here: t_d = t = 0.5 in)
  near(s0.FI, 0.00256 * s0.Kz * 50 * 50 * 0.85 * 0.7 * ((9.8 + 2 * s0.td) / 12) * 3.5, 1e-9, 'F_i,ice');
});
test('LPSG: a cut inside a segment takes the part above it as uniform over the segment; the base takes F_i at z_i', () => {
  const lp = lpEngine(), st = { zBot: 0, zTop: 3.5, z: 1.75 };
  assert.equal(JSON.stringify(lp.call('lppSegPart', st, 0)), JSON.stringify({ k: 1, arm: 1.75 }));
  const q = lp.call('lppSegPart', st, 1.75); near(q.k, 0.5, 1e-12, 'k'); near(q.arm, 0.875, 1e-12, 'arm');
  assert.equal(lp.call('lppSegPart', st, 3.5), null);
  // map-basis ice above a cut at the top of the lowest segment = Σ W_i of the nine segments above it
  const inp = lpDefaultInp({ iceBasis: 'map', iceIi: 1.0 }), pw = lp.call('poleWindNominal', inp);
  near(pw.iceAbove(3.5), pw.strips.slice(1).reduce((a, s) => a + s.Wi, 0), 1e-9, 'ice above 3.5 ft'); near(pw.iceAbove(0), pw.WiceMast, 1e-9, 'ice above 0');
});
test('LPSG: LRFDLTS windForces gives 10 support segments; sectionWind at the base = Σ F_i z_i, at a mid-segment cut the upper half', () => {
  const L = ltsEngine(), g = { mode: 'pole', shape: 'round', H: 40, Dtop: 4.5, Dbase: 8, rs: 0, fixtures: [], DCpole: 300, DL: 0 };
  const fr = L.windForces(g, 130, 'extreme', 0), sup = fr.filter(q => q.kind === 'strip');
  assert.equal(sup.length, 10); near(sup[0].zTop - sup[0].zBot, 4, 1e-12, 'L_i');
  const F = sup.reduce((a, q) => a + q.Fx, 0), M = sup.reduce((a, q) => a + q.Fx * q.z, 0), w0 = L.sectionWind(fr, 0);
  near(w0.Vx, F, 1e-9, 'V base'); near(w0.Mx, M, 1e-9, 'M base');
  const w2 = L.sectionWind(fr, 2), up = sup.slice(1);
  near(w2.Vx, up.reduce((a, q) => a + q.Fx, 0) + sup[0].Fx / 2, 1e-9, 'V at 2 ft');
  near(w2.Mx, up.reduce((a, q) => a + q.Fx * (q.z - 2), 0) + sup[0].Fx / 2 * 1, 1e-9, 'M at 2 ft');
  // segment force: P_z·d·L_i at the mid-height
  near(sup[0].Fx, sup[0].Pz * (sup[0].d / 12) * 4, 1e-9, 'F = P_z d L');
});
