#!/usr/bin/env node
// Bridge Substructure Loading (SubLoads): height of the superstructure horizontal forces at an abutment (SLFH, engineer decision 2026-11-11,
// aligned with the Abutment Calculator's z_brg = t_f + h_stem). TU, FR, SH, WS on the superstructure, WL and the EQ superstructure inertia act
// at the bridge seat (top of the stem under the pedestals, R.stemTop) instead of the top of the bearings (mean bottom of girder); BR and CE
// (6 ft above the deck, couple at the bearings) and every pier are unchanged. Hand check, default project, Abut. 1:
//   bottom of footing El. 105.000; top of bearings (mean bottom of girder) El. 118.917 → arm 13.917 ft; bridge seat El. 117.991 → arm 12.991 ft
//   TU fall H = 51.641 kip: M_l = 51.641 × 13.917 = 718.671 → 51.641 × 12.991 = 670.856 kip-ft; TU rise −34.427: −479.114 → −447.237
//   WS Strength III, 0° from the right: M_l −168.119 → −161.004 (H 7.684 × 0.926); WL 0°: −19.810 → −18.492; BR 28.243 unchanged
//   Strength I M_l max, bottom of footing: 4499.406 → 4451.591 (Δ = γ_TU 1.00 × 51.641 × 0.926 = 47.815)
//   A_s = 0.15 (site class D): Extreme Event I M_l max 4328.052 → 4210.395; Pier 1 unchanged (Strength I M_l 3251.156, EE I 23448.938)
//   node tests/smoke/bsl-force-height.mjs
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
  const run = seis => p.evaluate(seis => { P = defP(); syncSupports(); if (seis) { P.br.eqSa = SA_T.map(T => T === 0 ? 0.15 : Math.min(0.35, 0.12 / Math.max(T, 0.01))).map(v => String(+v.toFixed(4))); P.br.eqSiteClass = 'D'; }
    MODEL.cacheEE = null; recompute(); const o = {};
    [0, 1].forEach(k => { const r = unitRes(k), defs = r.UM.defs, at = l => defs.findIndex(x => x.label === l), qM = at('M<sub>l</sub>, bottom of footing'), qS = at('M<sub>l</sub>, bridge seat'), C = combine(k), p3 = phase3(k), p4 = phase4(k), p5 = phase5(k);
      o[k] = { zB: r.UM.zB[0], seat: r.UM.zSeat, ftgBot: MODEL.UG[k].ftgBot, TU: p4.TU.map(v => v[qM]), TUs: qS >= 0 ? p4.TU.map(v => v[qS]) : null, WS: p3.WS.III[0][qM], WL: p3.WL[0][qM], BR: p3.BR[0][qM],
        Str: C.StrI.max[qM], EE: C.EEI.max[qM], EQs: p5.vL && qS >= 0 ? p5.vL[qS] : null }; });
    return o; }, seis);
  const A = await run(false), E = await run(true);
  await ok('Abut. 1 elevations: bottom of footing 105.000, top of bearings 118.917, bridge seat 117.991', () => { near(A[0].ftgBot, 105, 1e-9, 'ftgBot'); near(A[0].zB, 118.917, 0.001, 'zB'); near(A[0].seat, 117.991, 0.001, 'seat'); });
  await ok('TU at the seat: fall 670.856, rise −447.237 kip-ft at the bottom of footing; 0 at the bridge seat', () => { near(A[0].TU[1], 670.856, 0.001, 'fall'); near(A[0].TU[0], -447.237, 0.001, 'rise'); A[0].TUs.forEach(v => near(v, 0, 1e-9, 'seat')); });
  await ok('WS (Str III 0°) −161.004 and WL (0°) −18.492 at the seat; BR 28.243 unchanged', () => { near(A[0].WS, -161.004, 0.001, 'WS'); near(A[0].WL, -18.492, 0.001, 'WL'); near(A[0].BR, 28.243, 0.001, 'BR'); });
  await ok('Strength I M_l max, bottom of footing: 4451.591 (was 4499.406)', () => near(A[0].Str, 4451.591, 0.001, 'StrI'));
  await ok('A_s = 0.15: Extreme Event I M_l max 4210.395 (was 4328.052); EQ superstructure inertia gives 0 at the bridge seat', () => { near(E[0].EE, 4210.395, 0.001, 'EEI'); near(E[0].EQs, 0, 1e-9, 'EQ seat'); });
  await ok('Pier 1 unchanged: top of bearings, Strength I M_l 3251.156, Extreme Event I 23448.938', () => { assert.equal(A[1].seat, null); near(A[1].Str, 3251.156, 0.001, 'pier StrI'); near(E[1].EE, 23448.938, 0.001, 'pier EEI'); });
  await ok('§6 notes: Temperature, Wind, Braking and Seismic tabs, and the Report', async () => {
    const t = await p.evaluate(async () => { P = defP(); syncSupports(); recompute(); P.ui.sel = 0; const o = {}; for (const id of ['temp', 'wind', 'brce', 'eq']) { showTab(id); await new Promise(r => setTimeout(r, 150)); o[id] = document.getElementById('tab-' + id).innerText; }
      P.ui.sel = 1; showTab('temp'); await new Promise(r => setTimeout(r, 150)); o.pier = document.getElementById('tab-temp').innerText; o.rpt = JSON.stringify(slrModel()); return o; });
    for (const id of ['temp', 'wind', 'brce', 'eq']) { assert.match(t[id], /Force height at Abut\. 1:/, id); assert.match(t[id], /act at the bridge seat, El\. 117\.99 \(the top of the stem under the pedestals, 12\.99 ft above the bottom of footing\)/, id); assert.match(t[id], /top of the bearings, El\. 118\.92 \(13\.92 ft above the bottom of footing\)/, id); }
    assert.doesNotMatch(t.pier, /Force height at/);
    assert.match(t.rpt, /Height of the superstructure horizontal forces/); assert.match(t.rpt, /act at the bridge seat, El\. 117\.99 \(top of the stem under the pedestals, 12\.99 ft above the bottom of footing\)/);
  });
  await ok('0 console errors', () => assert.deepEqual(errs, []));
} finally { await b.close(); }
if (fails) { console.log(`${fails} failure(s)`); process.exit(1); }
console.log('all passed');
