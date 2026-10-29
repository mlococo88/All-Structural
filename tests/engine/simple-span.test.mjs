// shared/moving-load.js, analyze() with m.simple = true (independent simple spans, added 2026-10-29).
// Unfactored per-lane values with IM = 1.33 on the truck only (LRFD 3.6.2.1), lane 0.64 klf without IM (3.6.1.2.4),
// DF = 1. HL-93 design truck 8-32-32 kips, rear spacing 14-30 ft (14 governs), LRFD 10th Ed. 3.6.1.2.2.
// E 29000 ksi, uniform I 10000 in^4 (I does not change simple-span moments, shears or reactions). Tolerance 1e-7 relative
// (round-off of the unpivoted dense LU over 240+ elements, as tests/engine/static.test.mjs).
import assert from 'node:assert/strict';
import { loadShared, test } from './harness.mjs';

const W = loadShared('vehicles.js', 'moving-load.js'), S = W.SharedMovingLoad, V = W.SharedVehicles.build();
const P = V.presets; P.Fatigue = V.fatigue;   // as the page does
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);

function model(key, spans, o = {}) {
  const p = P[key];
  return Object.assign({
    spans, E: 29000, segs: [{ len: 0, I: 10000, bad: false }], axles: p.axles.map(a => [...a]), short: key, stdLane: null,
    udl: { ...p.udl }, vK: p.vary.k, vMin: p.vary.min, vMax: p.vary.max, neglect: p.neglect, dirs: [1, -1],
    secondary: null, multi: p.multi.on, mScale: p.multi.scale, mHmin: p.multi.hmin, mFixed: p.multi.fixed,
    imp: { method: p.imp.method, val: p.imp.val, S: 6.5, bal: false, onUdl: p.imp.onUdl },
    llf: 1, dfM: spans.map(() => 1), dfV: spans.map(() => 1), dfNeg: 0, step: 1, hStep: 2,
  }, o);
}
const run = m => S.analyze(m, { vehicles: P });
const eff = (R, t, x, pick) => { const i = R.effs.findIndex(ef => ef.t === t && Math.abs(ef.x - x) < 1e-6 && (!pick || pick(ef))); assert.ok(i >= 0, `${t} at ${x}`); return R.res[i]; };
const absM = (R, k) => { const A = S.absScan(R, mm => run(mm)); let b = 0; A.all.forEach(o => { if (o.ef.t === 'M' && A.inSpan(o, k)) b = Math.max(b, o.r.max); }); return b; };

// Closed forms, simple span L (truck 8-32-32 at 14 ft, W = 72 kips; resultant 4.667 ft behind the middle axle):
//   midspan M, truck (middle axle at L/2):          M = 32L/4 + (32 + 8)(L/2 − 14)/2 = 18L − 280
//   end shear, truck (rear 32 at the support):      V = [32L + 32(L − 14) + 8(L − 28)]/L = 72 − 672/L
//   lane:  M_mid = wL²/8,  V_end = wL/2   (w = 0.64)
//   absolute max M, truck + lane, middle axle at x:  F(x) = 1.33[72x(L − x − 4.667)/L − 112] + 0.32x(L − x),
//     dF/dx = 0  →  L − 2x = 1.33·72·4.667/L / (1.33·72/L + 0.32) = 446.88/(95.76 + 0.32L)
//
//   L = 60 ft:  M_mid = 1.33(800) + 288 = 1064.00 + 288 = 1352.00 kip-ft
//               V_end = 1.33(60.800) + 19.2 = 80.864 + 19.2 = 100.064 kips
//               x* = (60 − 3.8873)/2 = 28.056 ft; truck M(x*) = 806.351, ×1.33 = 1072.447, lane 286.791 → F = 1359.238 kip-ft
//               (truck alone, absolute: 72(L/2 − 2.333)²/L − 112 = 806.53 kip-ft at x = 27.667)
//   L = 110 ft: M_mid = 1.33(1700) + 968 = 2261.00 + 968 = 3229.00 kip-ft
//               V_end = 1.33(65.891) + 35.2 = 87.635 + 35.2 = 122.835 kips
//               x* = (110 − 3.4123)/2 = 53.294 ft; truck M(x*) = 1703.306, ×1.33 = 2265.397, lane 967.068 → F = 3232.466 kip-ft
//               (truck alone, absolute: 1703.56 kip-ft at x = 52.667)
const midM = L => 1.33 * (18 * L - 280) + 0.64 * L * L / 8;
const endV = L => 1.33 * (72 - 672 / L) + 0.64 * L / 2;
const absF = L => { const x = (L - 1.33 * 72 * (14 / 3) / L / (1.33 * 72 / L + 0.32)) / 2; return 1.33 * (72 * x * (L - x - 14 / 3) / L - 112) + 0.32 * x * (L - x); };

test('hand check: HL-93 truck + lane, single spans 60 ft and 110 ft (midspan M, end V, absolute max M)', () => {
  for (const L of [60, 110]) {
    const R = run(model('HL93-Truck', [L]));
    close(eff(R, 'M', L / 2).max, midM(L), 1e-7, `M mid L=${L}`);
    close(eff(R, 'V', 0).max, endV(L), 1e-7, `V end L=${L}`);
    close(absM(R, 0), absF(L), 2e-5, `abs M L=${L}`);   // 0.1 ft scan grid: within 0.02 kip-ft
  }
  close(midM(60), 1352, 1e-12, 'midM 60'); close(midM(110), 3229, 1e-12, 'midM 110');
  close(absF(60), 1359.238, 1e-6, 'absF 60'); close(absF(110), 3232.466, 1e-6, 'absF 110');
});

// Two simple spans 60 + 110 ft on a shared pier: each span gives the single-span values above; the pier reaction is
// the left-span + right-span reaction (reaction IL: triangle, 1 at the pier, 0 at both abutments).
//   One truck (multi off): middle 32 at the pier, rear 32 14 ft into the 110 ft span, 8 14 ft into the 60 ft span:
//     32 + 32(96/110) + 8(46/60) = 32 + 27.927 + 6.133 = 66.061;  lane 0.64(60 + 110)/2 = 54.4
//     R = 1.33(66.061) + 54.4 = 87.861 + 54.4 = 142.261 kips
//   90 % of two trucks (14 ft, headway 50 ft) + 90 % lane, LRFD 3.6.1.3.1 (interior pier reaction): truck 1 rear 32 at
//     the pier heading into the 60 ft span, truck 2 50 ft behind in the 110 ft span:
//     truck 1: 32 + 32(46/60) + 8(32/60) = 60.800; truck 2: 8(60/110) + 32(46/110) + 32(32/110) = 27.055; sum 87.855
//     R = 0.9[1.33(87.855) + 54.4] = 0.9(116.846 + 54.4) = 154.122 kips (governs)
test('hand check: two simple spans 60 + 110 ft: span values as single spans, pier M = 0, pier R summed (one truck / 90 % two trucks)', () => {
  const one = run(model('HL93-Truck', [60, 110], { simple: true, multi: false }));
  close(eff(one, 'M', 30).max, midM(60), 1e-9, 'M mid span 1'); close(eff(one, 'M', 115).max, midM(110), 1e-9, 'M mid span 2');
  close(eff(one, 'V', 0).max, endV(60), 1e-9, 'V at A'); close(-eff(one, 'V', 170).min, endV(110), 1e-9, 'V at C');
  close(-eff(one, 'V', 60, ef => ef.spans[0] === 0).min, endV(60), 1e-9, 'V left of pier');
  close(eff(one, 'V', 60, ef => ef.spans[0] === 1).max, endV(110), 1e-9, 'V right of pier');
  const Mp = eff(one, 'M', 60); assert.ok(Math.abs(Mp.max) < 1e-9 && Math.abs(Mp.min) < 1e-9, 'pier moment 0');
  const r1 = 1.33 * (32 + 32 * 96 / 110 + 8 * 46 / 60) + 0.64 * 85;
  close(eff(one, 'R', 60).max, r1, 1e-9, 'pier R one truck'); close(r1, 142.261, 1e-5, 'r1');
  const two = run(model('HL93-Truck', [60, 110], { simple: true }));
  const r2 = 0.9 * (1.33 * (32 + 32 * 46 / 60 + 8 * 32 / 60 + 8 * 60 / 110 + 32 * 46 / 110 + 32 * 32 / 110) + 0.64 * 85);
  const Rp = eff(two, 'R', 60); close(Rp.max, r2, 1e-9, 'pier R 90 % two trucks'); close(r2, 154.122, 1e-5, 'r2');
  assert.match(Rp.maxG.lab, /^0\.9×2 /);
  // The two-truck case reaches the interior reaction only: every M and V and the end reactions equal the one-truck run
  two.effs.forEach((ef, i) => { if (ef.t === 'R' && ef.interior) return;
    close(two.res[i].max, one.res[i].max, 1e-12, `${ef.t}@${ef.x} max`); close(two.res[i].min, one.res[i].min, 1e-12, `${ef.t}@${ef.x} min`);
    assert.ok(!(two.res[i].maxG && /×2/.test(two.res[i].maxG.lab)) && !(two.res[i].minG && /×2/.test(two.res[i].minG.lab)), `two-truck at ${ef.t}@${ef.x}`); });
  assert.ok(two.effs.every(ef => !ef.neg), 'no negative-moment section in simple spans');
  assert.match(two.check, /theory: 0 wL²/);
});

// A 3-span girder in simple-span mode equals three independent 1-span runs: M and V envelopes at every 1/20 point,
// end reactions (and each interior reaction is at least each adjacent span's own end reaction), deflection envelope,
// step solver; HL-93 (with the 90 % two-truck case on) and the LRFD fatigue truck.
// M and V influence lines of a simple span are linear between nodes, so the different meshes (Lt/240 vs L/240) give the
// same values to round-off; the deflection influence line is cubic, so the deflection is compared to 0.2 %.
for (const key of ['HL93-Truck', 'Fatigue']) {
  test(`3 simple spans 60/110/75 = three 1-span runs (${key})`, () => {
    const spans = [60, 110, 75], sup = [0, 60, 170, 245];
    const R3 = run(model(key, spans, { simple: true })), D3 = S.deflection(R3, { mode: 'lrfd', DF: 1, useIM: true });
    let nM = 0;
    spans.forEach((L, k) => {
      const R1 = run(model(key, [L])), D1 = S.deflection(R1, { mode: 'lrfd', DF: 1, useIM: true }), a = sup[k];
      R1.rows.forEach(r1 => {
        const r3 = R3.rows.find(r => r.k === k && r.t === r1.t); assert.ok(r3, `row ${k}/${r1.t}`);
        const m1 = R1.res[r1.mi], m3 = R3.res[r3.mi], v1 = R1.res[r1.vi], v3 = R3.res[r3.vi];
        close(m3.max, m1.max, 1e-7, `M max span ${k + 1} t=${r1.t}`); close(m3.min, m1.min, 1e-7, `M min span ${k + 1} t=${r1.t}`);
        close(v3.max, v1.max, 1e-7, `V max span ${k + 1} t=${r1.t}`); close(v3.min, v1.min, 1e-7, `V min span ${k + 1} t=${r1.t}`);
        nM++;
      });
      const rr = R1.effs.map((ef, i) => [ef, R1.res[i]]).filter(([ef]) => ef.t === 'R');
      [0, 1].forEach(q => {
        const r3 = eff(R3, 'R', a + q * L).max, r1 = rr[q][1].max;
        if ((k === 0 && q === 0) || (k === 2 && q === 1)) close(r3, r1, 1e-7, `end R span ${k + 1}`);
        else assert.ok(r3 >= r1 - 1e-9, `pier R ≥ span ${k + 1} reaction`);
      });
      D1.secs.forEach((s1, i) => {
        const j = D3.secs.findIndex(s => Math.abs(s.x - (a + s1.x)) < 1e-6); assert.ok(j >= 0);
        close(D3.res[j].dn, D1.res[i].dn, 2e-3, `defl span ${k + 1} x=${s1.x}`);
        assert.ok(Math.abs(D3.res[j].up) < 1e-9, 'no upward deflection');
      });
      // step solver (1e-6: its sampled shears near 0 carry ~1e-7 kips of round-off): the primary vehicle standing in this span only, plus lane over the span
      const c3 = R3.stepCase('p', null, null), c1 = R1.stepCase('p', null, null), p = 0.6 * L;
      const pl1 = c1.offs.map((o, i) => [p - o, c1.loads[i]]).filter(([x]) => x >= 0 && x <= L);
      const s1 = R1.stepSolve(pl1, [[0, L, 0.64]]), s3 = R3.stepSolve(pl1.map(([x, P]) => [x + a, P]), [[a, a + L, 0.64]]);
      [0, 0.25, 0.5, 0.75, 1].forEach(f => {
        const at = (S_, x, sp) => S_.pts.find(q => Math.abs(q[0] - x) < 1e-6 && q[5] === sp);   // q[5] = span (a pier point is in both)
        const q1 = at(s1, f * L, 0), q3 = at(s3, a + f * L, k);
        if (q1 && q3) for (let c = 1; c <= 4; c++) close(q3[c], q1[c], 1e-6, `step span ${k + 1} f=${f} c=${c}`);
      });
      close(s3.rAx[k], s1.rAx[0], 1e-6, 'step R left'); close(s3.rAx[k + 1], s1.rAx[1], 1e-6, 'step R right');
    });
    assert.equal(nM, 63);
  });
}

test('default unchanged: simple absent / false / true on one span give the same output', () => {
  const j = R => JSON.stringify([R.res, R.IL.map(a => [...a]), R.warn, R.check]);
  const a = j(run(model('HL93-Truck', [100, 120]))), b = j(run(model('HL93-Truck', [100, 120], { simple: false })));
  assert.equal(a, b);
  assert.equal(j(run(model('HL93-Truck', [90]))), j(run(model('HL93-Truck', [90], { simple: true }))));
});
