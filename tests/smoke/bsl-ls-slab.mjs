#!/usr/bin/env node
// Bridge Substructure Loading (SubLoads): live-load surcharge LS with an approach slab (SLLS, engineer decision 2026-11-11, aligned with the
// Abutment Calculator's lsRed option). With an approach slab on the backwall the final-state LS is removed under AASHTO LRFD 10th Ed.
// 3.11.6.5 too (option u.earth.lsRed: absent or 'yes' = removed, 'no' = kept); MassDOT 3.3.1.3 removes it as before. The construction
// stage keeps its LS. Hand check, default project, Abut. 1, approach slab on with the default slab (20 ft × 12 in, 50 %, no LL):
//   Rankine k_a = 0.30726, γ = 0.120 kcf, H = 20 ft (soil 17 ft), h_eq = 2 ft, heel 6 ft, L = 46.070 ft: p_LS = k_a γ h_eq = 0.073742 ksf
//   LS virtual plane 1.47484 k/ft × L = 67.946 kip at H/2 = 10 ft (M = 679.456); LS stem 1.25361 × L = 57.754; LS vertical 0.12 × 2 × 6 × L = 66.340
//   Strength I, bottom of footing: P max 2624.176 → 2508.080 (− 1.75 × 66.340), V_l max 683.879 → 564.975 (− 1.75 × 67.946),
//     M_l max 4439.331 → 3250.283 (− 1.75 × 679.456); Service I: P 1921.165 → 1854.825, V_l 465.759 → 397.813, M_l 2415.203 → 1735.747
//   SLFH (2026-11-11): TU / WS / WL at the bridge seat lower the M_l values by the same amount with and without LS: Strength I M_l
//     4439.331 → 4391.516 (kept), 3250.283 → 3202.468 (removed), no slab 4499.406 → 4451.591; Service I 2415.203 → 2363.400, 1735.747 → 1683.944
//   node tests/smoke/bsl-ls-slab.mjs
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
  const run = o => p.evaluate(o => { P = defP(); syncSupports(); const e = P.units[0].earth; if (o.owner) P.br.owner = o.owner; if (o.slab) e.asOn = 'yes'; if (o.lsRed !== undefined) e.lsRed = o.lsRed; recompute();
    const E = earthAbut(0), sum = (c, sec, k) => E.items.filter(i => i.cls === c && (!sec || i.sec === sec)).reduce((a, i) => a + (i[k] || 0), 0);
    const defs = unitRes(0).UM.defs, C = combine(0), at = l => defs.findIndex(x => x.label === l), q = n => at(n + ', bottom of footing');
    return { LSb: sum('LSh', 'bot', 'H'), LSt: sum('LSh', 'top', 'H'), LSv: sum('LSv', 'bot', 'W'), LShc: sum('LShc', '', 'H'), LSvc: sum('LSvc', '', 'W'), rem: lsSlabRem(P.units[0].earth),
      S: ['StrI', 'SerI'].map(id => [C[id].max[q('Axial')], C[id].max[q('V<sub>l</sub>')], C[id].max[q('M<sub>l</sub>')]]), ic: SubLoadsInputCheck.collect().length }; }, o);
  const A = await run({}), S = await run({ slab: true }), Sy = await run({ slab: true, lsRed: 'yes' }), Sn = await run({ slab: true, lsRed: 'no' }), M = await run({ slab: true, owner: 'massdot', lsRed: 'no' });
  await ok('no approach slab: LS as before (67.946 / 57.754 / 66.340 kip), Strength I P, V_l, M_l unchanged', () => {
    near(A.LSb, 67.946, 0.001, 'LSb'); near(A.LSt, 57.754, 0.001, 'LSt'); near(A.LSv, 66.340, 0.001, 'LSv'); assert.equal(A.rem, false);
    near(A.S[0][0], 2540.738, 0.001, 'P'); near(A.S[0][1], 683.879, 0.001, 'V'); near(A.S[0][2], 4451.591, 0.001, 'M'); });
  await ok('slab kept (lsRed = no): LS applied, Strength I 2624.176 / 683.879 / 4391.516, Service I 1921.165 / 465.759 / 2363.400', () => {
    near(Sn.LSb, 67.946, 0.001, 'LSb'); near(Sn.LSv, 66.340, 0.001, 'LSv');
    [[2624.176, 683.879, 4391.516], [1921.165, 465.759, 2363.400]].forEach((r, i) => r.forEach((v, j) => near(Sn.S[i][j], v, 0.001, 'S' + i + j))); });
  await ok('slab, lsRed absent (= removed) and yes: no final-state LS; Strength I 2508.080 / 564.975 / 3202.468, Service I 1854.825 / 397.813 / 1683.944', () => {
    for (const r of [S, Sy]) { assert.equal(r.rem, true); assert.equal(r.LSb + r.LSt + r.LSv, 0);
      [[2508.080, 564.975, 3202.468], [1854.825, 397.813, 1683.944]].forEach((x, i) => x.forEach((v, j) => near(r.S[i][j], v, 0.001, 'S' + i + j)));
      near(r.LShc, A.LShc, 1e-9, 'construction LS kept'); near(r.LSvc, A.LSvc, 1e-9, 'construction LSv kept'); assert.ok(r.LShc > 0); assert.equal(r.ic, 0); }
    near(Sn.S[0][0] - S.S[0][0], 1.75 * 66.340, 0.002, 'ΔP = 1.75 LSv'); near(Sn.S[0][1] - S.S[0][1], 1.75 * 67.946, 0.002, 'ΔV = 1.75 LSh'); near(Sn.S[0][2] - S.S[0][2], 1.75 * 679.456, 0.01, 'ΔM'); });
  await ok('MassDOT: removed whatever lsRed says (3.3.1.3)', () => { assert.equal(M.rem, true); assert.equal(M.LSb + M.LSt + M.LSv, 0); });
  await ok('§6 notes: Units pane option and note, Earth loads tab, Report', async () => {
    const t = await p.evaluate(async () => { P = defP(); syncSupports(); P.units[0].earth.asOn = 'yes'; recompute(); P.ui.sel = 0; P.ui.itab = document.querySelector('.itab[data-pane=earth]') ? 'earth' : 'units'; buildSide();   /* SLIT: the Earth loads input tab */
      const side = document.getElementById('sidebar').innerText, sel = document.getElementById('f_units_0_earth_lsRed').value;
      showTab('earth'); await new Promise(r => setTimeout(r, 200)); const tab = document.getElementById('tab-earth').innerText;
      const rpt = JSON.stringify(slrModel()); return { side, sel, tab, rpt }; });
    assert.equal(t.sel, 'yes'); assert.match(t.side, /Live-load surcharge LS with the slab/); assert.match(t.side, /removed in the final state by the approach slab \(AASHTO LRFD 10th Ed\. Art\. 3\.11\.6\.5, the permitted reduction\)/);
    assert.match(t.tab, /the final-state live-load surcharge is removed \(AASHTO LRFD 10th Ed\. Art\. 3\.11\.6\.5; .*Abutment Calculator.*\): with heq = 2\.00 ft the LS would be 67\.9 kip on the virtual back plane, 57\.8 kip on the stem and backwall and 66\.3 kip over the heel/);
    assert.match(t.rpt, /Live-load surcharge with the approach slab/); assert.match(t.rpt, /Final-state live-load surcharge LS removed by the approach slab \(AASHTO LRFD 10th Ed\. Art\. 3\.11\.6\.5/);
  });
  await ok('0 console errors', () => assert.deepEqual(errs, []));
} finally { await b.close(); }
if (fails) { console.log(`${fails} failure(s)`); process.exit(1); }
console.log('all passed');
