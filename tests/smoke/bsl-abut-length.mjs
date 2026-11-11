#!/usr/bin/env node
// Bridge Substructure Loading (SubLoads): abutment length along the bearing line L_ab (u.abut.L, blank = auto = W_deck / cos θ)
// and footing length L_ftg (u.abut.Lftg, blank = L_ab), SLAL (engineer request 2026-11-11). Blank = the old single length, so every
// existing project is unchanged. Hand check, default project, Abut. 1 (skew 15°, W_deck = 3.25 + 4 × 9.5 + 3.25 = 44.50 ft):
//   L_ab,auto = 44.50 / cos 15° = 46.070 ft; stem t = 4 ft, H = 9.991 ft; backwall 1.5 × 7.009 ft; footing 14 × 3 ft; w_c = 0.150 kcf
//   DC: stem 276.163 → 299.723 kip, backwall 72.656 → 78.854, footing 290.240 → 315.000 (L_ftg = 40: 252.000)   [auto → L_ab = 50 ft]
//   Rankine k_a = 0.30726, γ = 0.120 kcf, H = 20 ft (soil 17 ft), h_eq = 2 ft, heel 6 ft:
//   EH virtual plane 7.3742 k/ft × L: 339.728 → 368.710; EH stem 5.3279 k/ft × L: 245.454 → 266.393
//   LS virtual plane 1.47484 k/ft × L: 67.946 → 73.742; LS stem 1.25361 k/ft × L: 57.754 → 62.681; EV heel 12.24 k/ft × L: 563.894 → 612.000
//   Strength I, bottom of footing: P max 2540.738 → 2683.733 (Δ = 1.25 × 54.518 + 1.35 × 48.106 + 1.75 × 5.660 = 142.99),
//   V_l max 683.879 → 737.496 (Δ = 1.50 × 28.982 + 1.75 × 5.796 = 53.62), M_l max 4499.406 → 4725.755 kip-ft
//   L_ab = 50, L_ftg = 40: P max 2683.733 − 1.25 × 63.000 = 2604.983; V_l, M_l as L_ab = 50 (earth on L_ab)
//   node tests/smoke/bsl-abut-length.mjs
import assert from 'assert/strict';
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const FILE = process.env.BSL_FILE || path.join(REPO, 'Bridge Substructure Loading.html');
let fails = 0;
const ok = async (m, f) => { try { await f(); console.log('  ok   ' + m); } catch (e) { fails++; console.log('  FAIL ' + m + ': ' + String(e.message).slice(0, 400)); } };
const near = (a, b, t, m) => assert.ok(Math.abs(a - b) <= t, `${m}: ${a} vs ${b}`);

const { b, p, errs } = await openPage(FILE);
try {
  await p.waitForFunction(() => typeof MODEL !== 'undefined' && MODEL && MODEL.G); await p.waitForTimeout(800);
  await p.evaluate(() => { P = defP(); syncSupports(); recompute(); });
  const run = (L, Lf) => p.evaluate(([L, Lf]) => { const u = P.units[0]; if (L === undefined) { delete u.abut.L; delete u.abut.Lftg; } else { u.abut.L = L; u.abut.Lftg = Lf; } recompute();
    const R = MODEL.UG[0], E = earthAbut(0), sum = (c, sec, k) => E.items.filter(i => i.cls === c && i.sec === sec).reduce((a, i) => a + (i[k] || 0), 0);
    const defs = unitRes(0).UM.defs, C = combine(0), at = l => defs.findIndex(x => x.label === l), wt = n => R.comps.find(c => c.name === n).wt;
    let abx = null; try { const a = abutHandoffPayload(); const ab = a.p.abutments.find(x => x.supportIndex === 0); abx = { Lab: ab.calculatorInput.geom.Lab, Lftg: ab.calculatorInput.geom.Lftg, stem: ab.geometry.stemLengthAlongSkew }; } catch (e) { abx = 'ERR ' + e.message; }
    return { L: R.capLen, Lf: R.ftgL, stem: wt('Stem'), bw: wt('Backwall'), ftg: wt('Footing'), EHb: sum('EH', 'bot', 'H'), EHt: sum('EH', 'top', 'H'), LSb: sum('LSh', 'bot', 'H'), LSt: sum('LSh', 'top', 'H'), EV: sum('EV', 'bot', 'W'),
      P: C.StrI.max[at('Axial, bottom of footing')], V: C.StrI.max[at('V<sub>l</sub>, bottom of footing')], M: C.StrI.max[at('M<sub>l</sub>, bottom of footing')],
      C: MODEL.C.map(c => c[0] + ' ' + c[2]), ic: SubLoadsInputCheck.collect().map(x => x.label + ': ' + x.msg), abx };
  }, [L, Lf]);
  const A = await run(), Ab = await run('', ''), B = await run(50, ''), F = await run(50, 40), S = await run(30, '');
  await ok('absent and blank lengths: auto 46.070 ft, results as before', async () => {
    for (const r of [A, Ab]) { near(r.L, 44.5 / Math.cos(15 * Math.PI / 180), 1e-9, 'L'); near(r.Lf, r.L, 1e-12, 'Lf'); near(r.stem, 276.163, 0.001, 'stem'); near(r.bw, 72.656, 0.001, 'bw'); near(r.ftg, 290.240, 0.001, 'ftg');
      near(r.EHb, 339.728, 0.001, 'EHb'); near(r.EHt, 245.454, 0.001, 'EHt'); near(r.LSb, 67.946, 0.001, 'LSb'); near(r.LSt, 57.754, 0.001, 'LSt'); near(r.EV, 563.894, 0.001, 'EV');
      near(r.P, 2540.738, 0.001, 'P'); near(r.V, 683.879, 0.001, 'V'); near(r.M, 4499.406, 0.001, 'M'); assert.deepEqual(r.ic, []); assert.ok(!r.C.some(c => /L<sub>ab<\/sub>/.test(c)), 'no length warning'); }
    near(A.abx.Lab, 46.07, 0.001, 'hand-off Lab'); near(A.abx.Lftg, 46.07, 0.001, 'hand-off Lftg');
  });
  await ok('L_ab = 50 ft (L_ftg blank = 50): DC, EH, LS, EV and Strength I as the hand check', async () => {
    const r = B; assert.equal(r.L, 50); assert.equal(r.Lf, 50); near(r.stem, 299.723, 0.001, 'stem'); near(r.bw, 78.854, 0.001, 'bw'); near(r.ftg, 315, 0.001, 'ftg');
    near(r.EHb, 368.710, 0.001, 'EHb'); near(r.EHt, 266.393, 0.001, 'EHt'); near(r.LSb, 73.742, 0.001, 'LSb'); near(r.LSt, 62.681, 0.001, 'LSt'); near(r.EV, 612, 0.001, 'EV');
    near(r.P, 2683.733, 0.001, 'P'); near(r.V, 737.496, 0.001, 'V'); near(r.M, 4725.755, 0.001, 'M');
    assert.deepEqual(r.abx, { Lab: 50, Lftg: 50, stem: 50 }); assert.deepEqual(r.ic, []);
  });
  await ok('L_ab = 50, L_ftg = 40: footing DC 252.0, P max 2604.983; earth on L_ab; stem-longer-than-footing warning; hand-off Lftg 40', async () => {
    const r = F; near(r.ftg, 252, 0.001, 'ftg'); near(r.stem, 299.723, 0.001, 'stem'); near(r.EHb, 368.710, 0.001, 'EHb'); near(r.EV, 612, 0.001, 'EV');
    near(r.P, 2604.983, 0.001, 'P'); near(r.V, 737.496, 0.001, 'V'); near(r.M, 4725.755, 0.001, 'M');
    assert.ok(r.C.some(c => /^warn .*stem \(L<sub>ab<\/sub> = 50\.00 ft\) is longer than its footing \(L<sub>ftg<\/sub> = 40\.00 ft\)/.test(c)));
    assert.deepEqual(r.abx, { Lab: 50, Lftg: 40, stem: 50 });
  });
  await ok('L_ab = 30 ft: warning (not an error), shorter than the exterior bearing pedestals 41.57 ft', async () => {
    assert.deepEqual(S.ic, []); assert.ok(S.C.some(c => /^warn .*L<sub>ab<\/sub> = 30\.00 ft is shorter than the out-to-out .* = 41\.57 ft/.test(c)), S.C.join('\n'));
  });
  await ok('input check: L_ab and L_ftg blank or > 0', async () => {
    const r = await run(-5, 'abc'); assert.ok(r.ic.some(x => /^Abutment length along the bearing line L_ab: must be greater than 0 ft/.test(x)), r.ic.join('\n'));
    assert.ok(r.ic.some(x => /^Footing length L_ftg: "abc" is not a number/.test(x)), r.ic.join('\n'));
    const z = await run(0, ''); assert.ok(z.ic.some(x => /L_ab: must be greater than 0/.test(x)));
  });
  await ok('§6 note: Units pane (worked auto line, inputs) and the Geometry tab / Report geometry', async () => {
    await run(50, '');
    const t = await p.evaluate(async () => { P.ui.sel = 0; P.ui.itab = 'units'; buildSide(); const side = document.getElementById('sidebar').innerText, ph = document.getElementById('f_units_0_abut_L').placeholder;
      showTab('geometry'); await new Promise(r => setTimeout(r, 200)); return { side, ph, geo: document.getElementById('tab-geometry').innerText }; });
    assert.match(t.side, /Abutment length along the bearing line Lab \(blank = auto\)/); assert.match(t.side, /Footing length Lftg \(blank = Lab\)/); assert.equal(t.ph, 'auto 46.07');
    for (const s of [t.side, t.geo]) { assert.match(s, /Lab,auto = Wdeck \/ cos θ = 44\.50 \/ cos 15\.0° = 46\.07 ft; Lab = 50\.00 ft \(entered\), Lftg = 50\.00 ft \(blank = Lab\)/); assert.match(s, /every earth item on the Earth loads tab/); }
  });
  await ok('0 console errors', () => assert.deepEqual(errs, []));
} finally { await b.close(); }
if (fails) { console.log(`${fails} failure(s)`); process.exit(1); }
console.log('all passed');
