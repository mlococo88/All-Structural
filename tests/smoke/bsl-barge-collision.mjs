#!/usr/bin/env node
// Bridge Substructure Loading, Vessel collision tab: barge collision force with the AASHTO LRFD 10th Ed. (2024) standard
// hopper barge equations, KE (Eq. 3.14.7-1), a_B (Eq. 3.14.12-1), P_B (Eqs. 3.14.11-1, -2), scaled for a wider barge by the
// Guide Specifications width ratio R_B = max(1.0, B_B/35): a_B = a_B,35/R_B, P_B = (Eq. 3.14.11-1 or -2) × R_B; never below the
// 35 ft hopper value (BVC #1320, then BVF, engineer 2026-11-10). Hand-check values (fixlog/Bridge Substructure Loading.md, BVF):
//   W = 1,700 tonnes, V = 6 ft/s, C_H = 1.05: KE = 1.05 × 1700 × 6²/29.2 = 2,200.68 kip-ft; a_B,35 = 10.2[(1 + 2200.68/5672)^½ − 1] = 1.8169 ft.
//   B_B = 35: R_B = 1.000, a_B = 1.8169 ft, P_B = 1349 + 110 × 1.8169 = 1,548.86 kip (unchanged).
//   B_B = 50: R_B = 1.4286, a_B = 1.2719 ft, P_B = (1349 + 110 × 1.2719) × 1.4286 = 2,127.0 kip (main before #1320: 2,127.0; #1320: 1,548.9).
//   B_B = 20: R_B = max(1.0, 0.571) = 1.000, P_B = 1,548.86 kip (no reduction; main before #1320: 970.7).
//   W = 200 tonnes, V = 2 ft/s, B_B = 50: KE = 28.767 kip-ft, a_B,35 = 0.025833, a_B = 0.018083 ft < 0.34, P_B = 4112 × 0.018083 × 1.4286 = 106.23 kip.
// Pier 1 of the default project, impact El. 108.0, each column in turn: Extreme Event II V_t at the bottom of the footing
// 1,552.7 kip at B_B = 35 and 20 ft, 2,130.8 kip at 50 ft. The Units pane shows the Barge width input with the saved u.cv.BB.
//   node tests/smoke/bsl-barge-collision.mjs
import assert from 'assert/strict';
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.join(REPO, 'Bridge Substructure Loading.html');
const { b, p, errs } = await openPage(FILE);
let fails = 0;
const ok = (c, m) => { try { c(); console.log('  ok  ' + m); } catch (e) { fails++; console.log('  FAIL ' + m + ': ' + String(e.message).slice(0, 300)); } };
const near = (a, e, tol, m) => assert.ok(Math.abs(a - e) <= tol, `${m}: ${a} vs ${e}`);
try {
  await p.waitForFunction(() => typeof MODEL !== 'undefined' && MODEL && MODEL.G);
  const run = (cv) => p.evaluate(async cv => {
    const u = P.units[1]; fillCol(u); Object.assign(u.cv, { on: 'yes', type: 'barge', W: 1700, Vs: 6, CH: 1.05, mhw: 108, chAng: 0, hit: 'all' }, cv);
    recompute(); await new Promise(r => setTimeout(r, 300));
    const p6 = phase6(1), defs = unitRes(1).UM.defs, q = defs.findIndex(d => d.grp === 'Resultant' && /^V<sub>t<\/sub>, bottom of footing$/.test(d.label));
    const E = combine(1).EEII;
    P.ui.sel = 1; showTab('cv'); await new Promise(r => setTimeout(r, 100));
    const tab = document.getElementById('tab-cv').innerText; document.querySelector(document.querySelector('.itab[data-pane=coll]') ? '.itab[data-pane=coll]' : '.itab[data-pane=units]').click();   /* SLIT: the Collision input tab */ await new Promise(r => setTimeout(r, 100)); const inp = document.getElementById('f_units_1_cv_BB');
    return { F: p6.cv.F, aB: p6.cv.aB, RB: p6.cv.RB, KE: p6.cv.KE, how: p6.cv.how, q, Vt: E.max[q], tab, BB: u.cv.BB, inp: inp ? inp.value : null };
  }, cv);
  const r35 = await run({ BB: 35 }), r50 = await run({ BB: 50 }), r20 = await run({ BB: 20 }), rs = await run({ BB: 50, W: 200, Vs: 2 });
  ok(() => { near(r35.KE, 2200.68, 0.01, 'KE'); near(r35.RB, 1, 0, 'R_B'); near(r35.aB, 1.81693, 1e-5, 'a_B'); near(r35.F, 1548.862, 0.001, 'P_B'); }, 'B_B = 35 ft: KE 2,200.68 kip-ft, R_B 1.000, a_B 1.8169 ft, P_B 1,548.86 kip (unchanged)');
  ok(() => { near(r50.RB, 50 / 35, 1e-12, 'R_B'); near(r50.aB, 1.27185, 1e-5, 'a_B'); near(r50.F, 2127.005, 0.001, 'P_B'); }, 'B_B = 50 ft: R_B 1.4286, a_B 1.2719 ft, P_B 2,127.0 kip (#1320: 1,548.9)');
  ok(() => { near(r20.RB, 1, 0, 'R_B'); near(r20.F, 1548.862, 0.001, 'P_B'); }, 'B_B = 20 ft: R_B 1.000, P_B 1,548.86 kip (no reduction)');
  ok(() => { near(rs.KE, 28.767, 0.001, 'KE'); near(rs.aB, 0.0180833, 1e-6, 'a_B'); near(rs.F, 106.227, 0.001, 'P_B'); assert.match(rs.how, /4112a<sub>B<\/sub>R<sub>B<\/sub> = 4112 × 0\.018 × 1\.429/); assert.match(rs.how, /Eq\. 3\.14\.11-1, a<sub>B<\/sub> (&lt;|<) 0\.34 ft/); }, 'W = 200 t, V = 2 ft/s, B_B = 50: a_B 0.01808 ft, P_B 106.23 kip (Eq. 3.14.11-1 × R_B)');
  ok(() => { assert.ok(r35.q >= 0); near(r20.Vt, r35.Vt, 1e-6, 'EE II V_t'); near(r35.Vt, 1552.7, 0.1, 'EE II V_t 35'); near(r50.Vt, 2130.8, 0.1, 'EE II V_t 50'); }, 'Pier 1 EE II V_t, bottom of footing: 1,552.7 kip at B_B = 35 and 20 ft, 2,130.8 kip at 50 ft');
  ok(() => { assert.match(r50.how, /Eq\. 3\.14\.12-1/); assert.doesNotMatch(r50.how, /3\.14\.9-1/); assert.match(r50.how, /R<sub>B<\/sub> = max\(1\.0, B<sub>B<\/sub>\/35\) = max\(1\.0, 50\.0\/35\) = 1\.429/); assert.match(r50.how, /\(1349 \+ 110 × 1\.272\) × 1\.429 = 2,127\.0 kip \(Eq\. 3\.14\.11-2/); }, 'worked line: a_B,35 (Eq. 3.14.12-1), R_B clamped, values substituted');
  ok(() => { assert.match(r50.tab, /10th Ed\. barge equations for the standard 35 ft hopper barge/); assert.match(r50.tab, /never below the 35 ft hopper barge value \(engineer's decision, 2026-11-10\)/); assert.match(r50.tab, /Guide Specifications are not in the reference folder/); assert.doesNotMatch(r50.tab, /3\.14\.9-1|no barge width ratio/); }, 'Vessel collision tab: basis note (Guide Specifications ratio, never reduced), no Eq. 3.14.9-1');
  ok(() => { assert.equal(r50.BB, 50); assert.equal(r20.inp, '20'); assert.equal(r50.inp, '50'); }, 'Units pane: Barge width input shows the saved u.cv.BB');
  await run({ BB: 50 });   // the Report at W = 1,700 t, V = 6 ft/s, B_B = 50 ft
  const rpt = await p.evaluate(async () => { const rb = [...document.querySelectorAll('.tab-btn')].find(x => /Report/.test(x.textContent)); rb.click(); await new Promise(r => setTimeout(r, 2500)); return SLR.doc ? SharedReport.text(SLR.doc) : ''; });
  ok(() => { assert.match(rpt, /never below the 35 ft hopper barge value \(engineer's decision, 2026-11-10\)/); assert.match(rpt, /= 10\.2\[\(1 \+ 2,201\/5672\)\^\(?1\/2\)? − 1\] = 1\.817 ft \(Eq\. 3\.14\.12-1/); assert.match(rpt, /= 2,127\.0 kip/); assert.match(rpt, /UF\/FDOT report 2010\/68901/); assert.doesNotMatch(rpt, /3\.14\.9-1|no barge width ratio/); }, 'Report: basis note, worked a_B (Eq. 3.14.12-1), P_B 2,127.0 kip, references');
  ok(() => assert.deepEqual(errs, []), '0 console errors');
} finally { await b.close(); }
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
