#!/usr/bin/env node
// CBSB (2026-11-13): Concrete Beam Capacity, Beam Capacity tab, ACI mode: member type "One-way slab" (12 in strip, bars at a spacing),
// at 1400 and 390 px, file://, 0 console errors. Hand check (one-way slab, h 9 in, d 6.25 in, #5 @ 12 in, f'c 4 ksi, f_y 60 ksi):
//    A_s = 0.31 in²/ft; a = 0.31(60)/(0.85(4)(12)) = 0.456 in; φM_n = 0.9(0.31)(60)(6.25 − 0.228)/12 = 8.40 kip-ft/ft
//    A_s,min = 0.0018(12)(9) = 0.194 in² (7.6.1.1) PASS; s = 12 ≤ min(3h, 18) = 18 in (7.7.2.3) PASS
//    V_c (no stirrups, row (c)): λ_s = 1.0 (capped), ρ_w = 0.31/(12 × 6.25) = 0.00413, V_c = 8(1)(0.00413)^(1/3)√4000(12)(6.25) = 6.09 kip;
//    φV_c = 4.57 kip: V_u 3 -> A_v,min not required (N/A, 7.6.3.1); V_u 5 > 4.57 -> required, none provided: FAIL
//    S&T #4 @ 12: ρ = 0.20/(12 × 9) = 0.00185 ≥ 0.0018 PASS, s 12 ≤ min(5h, 18) = 18 PASS; none entered: FAIL
//  Beam again: integer bars per layer; a saved project without memberType opens as a beam.
//   node tests/smoke/cbc-slab.mjs [--file <Concrete Beam Capacity.html>]
import path from 'path';
import { openPage, REPO } from '../lib.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FILE = path.resolve(arg('file', path.join(REPO, 'Concrete Beam Capacity.html')));
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const near = (a, b, t) => Math.abs(a - b) <= t;
const ST = { proj: { name: 'Slab' }, code: 'ACI', loadMode: 'factored', sec: { type: 'rect', bw: 14, h: 9 }, mat: { fc: 4, fy: 60, fyt: 60 }, tor: { present: false },
  stir: { present: true, size: '4', legs: 2, s: 6 }, layers: [{ n: 1, size: '5', face: 'tension', dMan: 6.25 }], combos: [{ name: 'U', Mu: 6, Vu: 3, Tu: 0 }] };
for (const vw of [1400, 390]) {
  console.log('--- viewport ' + vw + ' px');
  const { b, p, errs } = await openPage(FILE, { hash: '#capacity', vw, vh: 900, ls: { rcbeam_v2_auto: JSON.stringify(ST) } });
  const f = await (await p.$('#suite-frame-capacity')).contentFrame();
  await f.waitForFunction(() => typeof computeAll === 'function' && typeof CC !== 'undefined' && CC, null, { timeout: 30000 });
  ok(await f.evaluate(() => S.memberType === 'beam' && S.sec.bw === 14), 'a saved project without memberType opens as a beam');
  const det = () => f.evaluate(() => { const o = {}; CC.combos[0].det.forEach(d => o[d.id] = { have: d.have, need: d.need, ok: d.ok, na: d.na, ref: d.ref }); return o; });
  let r = await f.evaluate(() => { const s = document.querySelector('[data-fkey="memberType"]'); s.value = 'slab'; s.dispatchEvent(new Event('change'));
    const c = CC.combos[0]; return { bw: S.sec.bw, st: S.stir.present, L: S.layers[0], As: c.F.As, phiMn: c.phiMn, Vc: c.sh.Vc, phiVc: c.sh.phi * c.sh.Vc, bwRO: document.querySelector('[data-fkey="bw"]').readOnly, sp: !!document.querySelector('[data-fkey="lsp0"]') }; });
  ok(r.bw === 12 && r.bwRO && !r.st && r.L.s === 12 && r.L.n === 1 && r.sp, 'one-way slab: b = 12 in (locked), stirrups off, layer #5 @ 12 in (spacing input)');
  ok(near(r.As, 0.31, 1e-9) && near(r.phiMn, 8.40, 0.005) && near(r.Vc, 6.09, 0.005) && near(r.phiVc, 4.57, 0.005), `A_s ${r.As}, φM_n ${r.phiMn.toFixed(2)} (8.40), V_c ${r.Vc.toFixed(2)} (6.09), φV_c ${r.phiVc.toFixed(2)} (4.57)`);
  let d = await det();
  ok(near(d.dAsMin.need, 0.1944, 1e-9) && d.dAsMin.ok && d.dAsMin.ref === 'ACI 7.6.1.1', 'A_s,min 0.0018A_g = 0.194 (7.6.1.1) PASS');
  ok(d.dSlabS && d.dSlabS.have === 12 && d.dSlabS.need === 18 && d.dSlabS.ok, 'bar spacing 12 ≤ min(3h, 18) = 18 (7.7.2.3) PASS');
  ok(d.dStA && !d.dStA.ok && d.dStS && !d.dStS.ok, 'shrinkage and temperature bars not entered: FAIL');
  ok(d.dAvMin.na && d.dAvMin.ref === 'ACI 7.6.3.1' && d.dStirS.na && d.dStirLeg.na && !d.dSkin, 'V_u 3 ≤ φV_c: A_v,min N/A (7.6.3.1); stirrup checks N/A; no skin row');
  await f.evaluate(() => { S.slab.stSize = '4'; S.slab.stS = 12; S.combos[0].Vu = 5; refresh(); }); d = await det();
  ok(near(d.dStA.have, 0.2 / 108, 1e-9) && d.dStA.ok && d.dStS.ok, `S&T #4 @ 12: ρ ${d.dStA.have.toFixed(5)} (0.00185) PASS, s 12 ≤ 18 PASS`);
  ok(!d.dAvMin.na && !d.dAvMin.ok, 'V_u 5 > φV_c 4.57: A_v,min required (7.6.3.1), none provided: FAIL');
  r = await f.evaluate(() => { S.ui.tab = 'tabInputEcho'; refresh(); const ie = document.getElementById('tabPages').innerText; const t = SharedReport.text(SharedReport.build(mrModel()), { legacy: true });
    const tabs = []; TABS().forEach(([id]) => { S.ui.tab = id; refresh(); const w = document.documentElement.scrollWidth - document.documentElement.clientWidth; if (w > 1) tabs.push(id); });
    return { ie: /@ 12\.00 in\t#5/.test(ie), t: /7\.6\.1\.1/.test(t) && /24\.4\.3\.2/.test(t) && /7\.7\.2\.3/.test(t) && /7\.6\.3\.1/.test(t), bad: /NaN|undefined|\[\[/.test(t), tabs }; });
  ok(r.ie && r.t && !r.bad, 'Input Echo "@ 12.00 in | #5"; Report cites 7.6.1.1, 7.7.2.3, 24.4.3.2, 7.6.3.1; no NaN or unresolved link');
  ok(!r.tabs.length, 'no sideways scroll on any tab' + (r.tabs.length ? ': ' + r.tabs.join(', ') : ''));
  r = await f.evaluate(() => { const s = document.querySelector('[data-fkey="memberType"]'); s.value = 'beam'; s.dispatchEvent(new Event('change')); return { mt: S.memberType, L: S.layers[0] }; });
  ok(r.mt === 'beam' && r.L.n === 1 && r.L.s === undefined, 'back to beam: integer bars, no spacing');
  ok(!errs.length, 'console errors: ' + errs.length + (errs.length ? ' ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
}
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
