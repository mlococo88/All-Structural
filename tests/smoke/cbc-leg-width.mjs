#!/usr/bin/env node
// CBLW (2026-11-13): Concrete Beam Capacity, Beam Capacity tab, ACI mode: "Stirrup leg spacing across the width" (ACI 318-19 Table
// 9.7.6.2.2), at 1400 and 390 px, file://, 0 console errors.
//  Hand check: b_w 36 in, d 20 in, clear cover 1.5 in, #4 stirrups (d_s 0.5 in), f'c 4 ksi, V_u 60 kip (V_s,req below 4√f'c b_w d):
//    2 legs: s_w = (36 − 2(1.5) − 0.5)/(2 − 1) = 32.50 in > min(d, 24) = 20 in -> FAIL; 3 legs: 32.5/2 = 16.25 in ≤ 20 -> PASS.
//    #5 three legs at 4 in, V_u 250 (V_s,req > 4√f'c b_w d, the along-length switch): s_w = (36 − 3 − 0.625)/2 = 16.19 > min(d/2, 12) = 10 -> FAIL.
//  N/A without stirrups; no row in AASHTO mode; in the check summary, the Detailing tab and the Report, with links.
//   node tests/smoke/cbc-leg-width.mjs [--file <Concrete Beam Capacity.html>]
import path from 'path';
import { openPage, REPO } from '../lib.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FILE = path.resolve(arg('file', path.join(REPO, 'Concrete Beam Capacity.html')));
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const near = (a, b, t) => Math.abs(a - b) <= t;
const ST = { proj: { name: 'LW', date: '2026-11-13' }, code: 'ACI', loadMode: 'factored', sec: { type: 'rect', bw: 36, h: 24 }, mat: { fc: 4, fy: 60, fyt: 60 },
  cover: { cc: 1.5, exposure: 'interior', req: 1.5, userEdited: true }, tor: { present: false }, stir: { present: true, size: '4', legs: 2, s: 8 },
  layers: [{ n: 6, size: '8', face: 'tension', dMan: 20 }], combos: [{ name: 'W1', Mu: 200, Vu: 60, Tu: 0 }] };
for (const vw of [1400, 390]) {
  console.log('--- viewport ' + vw + ' px');
  const { b, p, errs } = await openPage(FILE, { hash: '#capacity', vw, vh: 900, ls: { rcbeam_v2_auto: JSON.stringify(ST) } });
  const f = await (await p.$('#suite-frame-capacity')).contentFrame();
  await f.waitForFunction(() => typeof computeAll === 'function' && typeof CC !== 'undefined' && CC, null, { timeout: 30000 });
  const leg = () => f.evaluate(() => { const x = CC.combos[0].det.find(d => d.id === 'dStirLeg'); return x ? { have: x.have, need: x.need, ok: x.ok, na: x.na } : null; });
  let r = await leg();
  ok(r && near(r.have, 32.5, 1e-9) && near(r.need, 20, 1e-9) && !r.ok, `2 legs: s_w ${r && r.have} (32.50) > ${r && r.need} (20.00): FAIL`);
  r = await f.evaluate(() => { const c = allChecks().find(x => x.id === 'dStirLeg'), d = cbcDashItems().find(x => x.name === 'Stirrup leg spacing across the width');
    S.ui.tab = 'tabDetail'; refresh(); const card = (document.querySelector('#detdStirLeg') || {}).innerText || '';
    const t = SharedReport.text(SharedReport.build(mrModel()), { legacy: true }); return { c, d, card, t }; });
  ok(r.c && r.c.forceOK === false && r.d && r.d.st === 'fail' && r.d.cond === 'leg spacing > s_max' && r.d.card === 'detdStirLeg', 'check summary: FAIL, "leg spacing > s_max", links to the Detailing card');
  ok(/32\.50/.test(r.card) && /equally spaced/.test(r.card) && /Shear · Combination 1/.test(r.card), 'Detailing card: worked s_w, the leg-position assumption, link to the Shear card');
  ok(/Stirrup leg spacing across the width/.test(r.t) && /32\.50/.test(r.t) && !/\[\[|NaN|undefined/.test(r.t), 'Report: worked, no unresolved link or NaN');
  await f.evaluate(() => { S.stir.legs = 3; refresh(); }); r = await leg();
  ok(r && near(r.have, 16.25, 1e-9) && r.ok, `3 legs: s_w ${r && r.have} (16.25) ≤ 20: PASS`);
  await f.evaluate(() => { S.stir.size = '5'; S.stir.s = 4; S.combos[0].Vu = 250; refresh(); }); r = await leg();
  ok(r && near(r.have, 16.1875, 1e-9) && near(r.need, 10, 1e-9) && !r.ok, `#5, V_u 250 (tight switch): s_w ${r && r.have.toFixed(2)} (16.19) > ${r && r.need} (10.00 = min(d/2, 12)): FAIL`);
  await f.evaluate(() => { S.stir.present = false; refresh(); }); r = await leg();
  ok(r && r.na, 'no stirrups: N/A');
  await f.evaluate(() => { S.stir.present = true; S.code = 'AASHTO'; refresh(); }); r = await leg();
  ok(!r, 'AASHTO mode: no across-width row (5.7.2.6 has no such limit)');
  const sw = await f.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(sw <= 1, 'no sideways scroll (' + sw + ')');
  ok(!errs.length, 'console errors: ' + errs.length + (errs.length ? ' ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
}
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
