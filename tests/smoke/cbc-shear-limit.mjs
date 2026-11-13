#!/usr/bin/env node
// CBSZ (2026-11-13): Concrete Beam Capacity, Beam Capacity tab, ACI mode: the section size limit of ACI 318-19 22.5.1.2 and the upper
// limit on V_c of 22.5.5.1.1, at 1400 and 390 px, file://, 0 console errors.
//  Hand check: b_w 12 in, d 20 in, f'c 4 ksi, λ 1.0, #4 two-leg stirrups at 8 in (A_v >= A_v,min: row (a)):
//    V_c = 2(1.0)√4000(12)(20)/1000 = 30.36 kip; 8√f'c b_w d = 8(63.246)(240)/1000 = 121.43 kip;
//    limit φ(V_c + 8√f'c b_w d) = 0.75(30.36 + 121.43) = 113.84 kip; V_c,max = 5(63.246)(240)/1000 = 75.89 kip (does not govern).
//    V_u 50: D/C 50/113.84 = 0.439 PASS; V_u 120: 1.054 FAIL "section too small", where shear also fails (D/C 1.771).
//  The check is in the check summary, the All Combinations × Limit States table, the Shear tab and the Report, with links;
//  AASHTO mode has no such row (its 5.7.3.3 limit is the V_n cap of Eq. 5.7.3.3-2, unchanged).
//   node tests/smoke/cbc-shear-limit.mjs [--file <Concrete Beam Capacity.html>]
import path from 'path';
import { openPage, REPO } from '../lib.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FILE = path.resolve(arg('file', path.join(REPO, 'Concrete Beam Capacity.html')));
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const near = (a, b, t) => Math.abs(a - b) <= t;
const ST = { proj: { name: 'SZ', date: '2026-11-13' }, code: 'ACI', loadMode: 'factored', sec: { type: 'rect', bw: 12, h: 22.5 }, mat: { fc: 4, fy: 60, fyt: 60, lambda: 1 },
  tor: { present: false }, stir: { present: true, size: '4', legs: 2, s: 8 }, layers: [{ n: 3, size: '8', face: 'tension', dMan: 20 }],
  combos: [{ name: 'H', Mu: 100, Vu: 50, Tu: 0 }, { name: 'H2', Mu: 100, Vu: 120, Tu: 0 }] };
for (const vw of [1400, 390]) {
  console.log('--- viewport ' + vw + ' px');
  const { b, p, errs } = await openPage(FILE, { hash: '#capacity', vw, vh: 900, ls: { rcbeam_v2_auto: JSON.stringify(ST) } });
  const f = await (await p.$('#suite-frame-capacity')).contentFrame();
  await f.waitForFunction(() => typeof computeAll === 'function' && typeof CC !== 'undefined' && CC, null, { timeout: 30000 });
  let r = await f.evaluate(() => CC.combos.map(x => ({ d: x.sh.d, Vc: x.sh.Vc, Vcr: x.sh.Vc_row, Vcm: x.sh.VcMax, Vs8: x.sh.VsMax, lim: x.szA.lim, dc: x.szA.dcr, dcV: x.dcV_eff, worst: x.worst })));
  ok(near(r[0].d, 20, 1e-9) && near(r[0].Vc, 30.358, 0.001) && near(r[0].Vs8, 121.43, 0.01) && near(r[0].lim, 113.84, 0.01) && near(r[0].Vcm, 75.89, 0.01) && r[0].Vc === r[0].Vcr,
    `V_c ${r[0].Vc.toFixed(3)} (30.36), 8√f'c b_w d ${r[0].Vs8.toFixed(2)} (121.43), limit ${r[0].lim.toFixed(2)} (113.84), V_c,max ${r[0].Vcm.toFixed(2)} (75.89, not governing)`);
  ok(near(r[0].dc, 0.439, 0.001) && near(r[1].dc, 1.054, 0.001) && r[1].dcV > r[1].dc && r[0].dcV >= r[0].dc, `D/C ${r[0].dc.toFixed(3)} (0.439), ${r[1].dc.toFixed(3)} (1.054); never above the shear D/C (${r[0].dcV.toFixed(3)}, ${r[1].dcV.toFixed(3)})`);
  r = await f.evaluate(() => { const c = allChecks().find(x => x.id === 'szA'), d = cbcDashItems().find(x => x.name === 'Section size limit (ACI 22.5.1.2)');
    S.ui.tab = 'tabSummary'; refresh(); const m = document.querySelector('#sumMatrix').innerText;
    S.ui.tab = 'tabShear'; refresh(); const sh = document.querySelector('#shC1').innerText;
    const t = SharedReport.text(SharedReport.build(mrModel()), { legacy: true });
    return { c, d, m, sh, t }; });
  ok(r.c && near(r.c.dcr, 1.054, 0.001) && r.c.combo === 'H2' && r.d && r.d.st === 'fail' && /section too small/.test(r.d.cond) && r.d.card === 'shC1', 'check summary: "Section size limit (ACI 22.5.1.2)" FAIL, H2, section too small, links to the Shear card');
  ok(/Size limit/i.test(r.m) && /1\.05/.test(r.m), 'All Combinations × Limit States: "Size limit" column (1.05)');
  ok(/Section size limit \(ACI 22\.5\.1\.2\)/.test(r.sh) && /113\.84/.test(r.sh) && /too small for this shear/.test(r.sh) && /Upper limit on V_c/.test(r.sh), 'Shear tab: V_c limit and section size limit worked, FAIL message');
  ok(/Section size limit/.test(r.t) && /113\.84/.test(r.t) && /75\.89/.test(r.t) && !/\[\[|NaN|undefined/.test(r.t), 'Report: both limits worked, no unresolved link or NaN');
  r = await f.evaluate(() => { S.code = 'AASHTO'; refresh(); return { a: allChecks().some(x => x.id === 'szA'), m: document.querySelector('#sumMatrix') ? document.querySelector('#sumMatrix').innerText : '' }; });
  ok(!r.a && !/Size limit/i.test(r.m), 'AASHTO mode: no 22.5.1.2 row or column');
  const sw = await f.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(sw <= 1, 'no sideways scroll (' + sw + ')');
  ok(!errs.length, 'console errors: ' + errs.length + (errs.length ? ' ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
}
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
