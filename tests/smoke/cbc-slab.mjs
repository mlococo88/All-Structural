#!/usr/bin/env node
// CBSB (2026-11-13): Concrete Beam Capacity, Beam Capacity tab, ACI mode: member type "One-way slab" (12 in strip, bars at a spacing),
// at 1400 and 390 px, file://, 0 console errors. Hand check (one-way slab, h 9 in, d 6.25 in, #5 @ 12 in, f'c 4 ksi, f_y 60 ksi):
//    A_s = 0.31 in²/ft; a = 0.31(60)/(0.85(4)(12)) = 0.456 in; φM_n = 0.9(0.31)(60)(6.25 − 0.228)/12 = 8.40 kip-ft/ft
//    A_s,min = 0.0018(12)(9) = 0.194 in² (7.6.1.1) PASS; s = 12 ≤ min(3h, 18) = 18 in (7.7.2.3) PASS
//    V_c (no stirrups, row (c)): λ_s = 1.0 (capped), ρ_w = 0.31/(12 × 6.25) = 0.00413, V_c = 8(1)(0.00413)^(1/3)√4000(12)(6.25) = 6.09 kip;
//    φV_c = 4.57 kip: V_u 3 -> A_v,min not required (N/A, 7.6.3.1); V_u 5 > 4.57 -> required, none provided: FAIL
//    S&T #4 @ 12: ρ = 0.20/(12 × 9) = 0.00185 ≥ 0.0018 PASS, s 12 ≤ min(5h, 18) = 18 PASS; none entered: FAIL
//  Beam again: integer bars per layer; a saved project without memberType opens as a beam.
//  CBSW (2026-11-13): width basis "Actual width b" (b = 48 and 50 in; b < s an input error), hand-off, labels, save / reopen, back to the strip.
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
  // CBSW (2026-11-13): width basis "Actual width b". The same #5 @ 12 in over b = 48 in: n = floor(48/12) = 4 bars, A_s = 1.24 in²,
  //   a = 1.24(60)/(0.85(4)(48)) = 0.456 in (as the strip), φM_n = 0.9(1.24)(60)(6.25 − 0.228)/12 = 33.60 kip-ft = 4 × 8.40;
  //   V_c = 4 × 6.09 = 24.36 kip (ρ_w = 1.24/(48 × 6.25) = 0.00413, as the strip), φV_c = 18.27 kip; A_s,min = 0.0018(48)(9) = 0.778 in².
  //   Spacing checks (7.7.2.3, 24.3.2, 24.4.3.3) and the S&T ratio (per ft along the span) unchanged. b = 50 in: n = floor(4.17) = 4
  //   (rounded down), a = 74.4/170 = 0.438 in, φM_n = 0.9(1.24)(60)(6.25 − 0.219)/12 = 33.65 kip-ft. b = 10 in < s: input error.
  const strip = await det();
  r = await f.evaluate(() => { const s = document.querySelector('[data-fkey="slabBMode"]'); s.value = 'actual'; s.dispatchEvent(new Event('change'));
    const i = document.querySelector('[data-fkey="bw"]'); const ro = i.readOnly; i.value = '48'; i.dispatchEvent(new Event('input'));
    const c = CC.combos[0]; return { ro, mode: S.slab.bMode, bw: S.sec.bw, n: S.layers[0].n, As: c.F.As, phiMn: c.phiMn, Vc: c.sh.Vc, phiVc: c.sh.phi * c.sh.Vc }; });
  ok(r.mode === 'actual' && !r.ro && r.bw === 48 && r.n === 4, `actual width: b input editable, b = 48 in, n = floor(48/12) = ${r.n} bars`);
  ok(near(r.As, 1.24, 1e-9) && near(r.phiMn, 33.603, 0.001) && near(r.phiMn, 4 * 8.40076, 0.001) && near(r.Vc, 24.36, 0.005) && near(r.phiVc, 18.27, 0.005),
    `b = 48: A_s ${r.As}, φM_n ${r.phiMn.toFixed(3)} (33.603 = 4 × 8.401), V_c ${r.Vc.toFixed(2)} (24.36), φV_c ${r.phiVc.toFixed(2)} (18.27)`);
  d = await det();
  ok(near(d.dAsMin.need, 0.7776, 1e-9) && d.dAsMin.ok, `A_s,min = 0.0018(48)(9) = ${d.dAsMin.need.toFixed(4)} in² (0.7776) PASS`);
  ok(['dSlabS', 'dStA', 'dStS', 'dCrack', 'dSpace', 'dEpsMin'].every(k => d[k].have === strip[k].have && d[k].need === strip[k].need && d[k].ok === strip[k].ok),
    'spacing checks (7.7.2.3, 24.3.2, 24.4.3.3), S&T ratio, clear spacing and ε_t identical to the strip');
  ok(d.dAvMin.na, 'V_u 5 ≤ φV_c 18.27 (b = 48): A_v,min N/A (7.6.3.1)');
  await p.waitForTimeout(500);
  r = await p.evaluate(() => { const a = document.getElementById('suite-frame-asd').contentWindow, v = document.getElementById('suite-frame-dev').contentWindow;
    let asd = null, dev = null; try { const I = a.eval('S.inherit'); asd = { bw: I.b_w, as: I.as_pos }; } catch (e) {} try { dev = v.eval('RBCAP.last'); } catch (e) {}
    return { asd, dev: dev && { bars: dev.bars, asProv: dev.asProv } }; });
  ok(r.asd && r.asd.bw === 48 && r.asd.as === 1.24 && r.dev && r.dev.bars === '4 #5 @ 12.00 in' && near(r.dev.asProv, 1.24, 1e-9),
    'hand-off: ASD b_w 48 in with A_s 1.24 in² (same width); Development & Splice bars "4 #5 @ 12.00 in", A_s,prov 1.24 ' + JSON.stringify(r));
  r = await f.evaluate(() => { const dash = document.getElementById('cbcDash').innerText; S.ui.tab = 'tabInputEcho'; refresh(); const ie = document.getElementById('tabPages').innerText;
    S.ui.tab = 'tabFlex'; refresh(); const fx = document.getElementById('tabPages').innerText; S.ui.tab = 'tabValid'; refresh(); const va = document.getElementById('tabPages').innerText;
    const t = SharedReport.text(SharedReport.build(mrModel()), { legacy: true });
    const tabs = []; TABS().forEach(([id]) => { S.ui.tab = id; refresh(); const w = document.documentElement.scrollWidth - document.documentElement.clientWidth; if (w > 1) tabs.push(id); });
    const inp = document.getElementById('inputPanel').textContent;
    return { dash: /One-way slab: results for b = 48\.00 in \(actual width\)/.test(dash), ie: /4 @ 12\.00 in\t#5/.test(ie), fx: /0\.85\(4\.00\)\(48\.00\)\(0\.46\)=74\.40/.test(fx.replace(/\s+/g, '')),
      va: /floor\(48\.00\/12\.00\) = 4/.test(va), t: /actual width b = 48\.00 in/.test(t) && /every result for b = 48\.00 in/.test(t) && /0\.0018\(48\.00\)\(9\.00\)/.test(t), bad: /NaN|undefined|\[\[/.test(t),
      inp: /enter the actions for b = 48\.00 in/.test(inp), tabs }; });
  ok(r.dash && r.ie && r.fx && r.va && r.inp, 'labels: check summary "results for b = 48.00 in", Input Echo "4 @ 12.00 in", C_c with b = 48.00, Validation n = floor(b/s), Loads input "for b = 48.00 in" ' + JSON.stringify(r));
  ok(r.t && !r.bad, 'Report: member type "actual width b = 48.00 in", summary "for b = 48.00 in", A_s,min 0.0018(48.00)(9.00); no NaN or unresolved link');
  ok(!r.tabs.length, 'actual width: no sideways scroll on any tab' + (r.tabs.length ? ': ' + r.tabs.join(', ') : ''));
  r = await f.evaluate(() => { const i = document.querySelector('[data-fkey="bw"]'); i.value = '50'; i.dispatchEvent(new Event('input'));
    const o = { n: S.layers[0].n, As: CC.combos[0].F.As, phiMn: CC.combos[0].phiMn };
    i.value = '10'; i.dispatchEvent(new Event('input')); o.blk = VALIDATION.blockers.map(x => x.msg).join(' ');
    i.value = '48'; i.dispatchEvent(new Event('input')); o.auto = JSON.parse(localStorage.getItem('rcbeam_v2_auto')).slab; return o; });
  ok(r.n === 4 && near(r.As, 1.24, 1e-9) && near(r.phiMn, 33.654, 0.001), `b = 50: n = floor(50/12) = ${r.n} (rounded down), φM_n ${r.phiMn.toFixed(3)} (33.654)`);
  ok(/Slab width b = 10\.00 in is less than/.test(r.blk), 'b = 10 < s = 12: input error');
  ok(r.auto.bMode === 'actual' && r.auto.b === 48, 'saved: slab.bMode "actual", slab.b 48');
  r = await f.evaluate(() => { const raw = localStorage.getItem('rcbeam_v2_auto'); S = defaultState(); mergeState(JSON.parse(raw)); refresh();
    const o = { bw: S.sec.bw, n: S.layers[0].n, phiMn: CC.combos[0].phiMn, same: localStorage.getItem('rcbeam_v2_auto') === raw };
    const s = document.querySelector('[data-fkey="slabBMode"]'); s.value = 'strip'; s.dispatchEvent(new Event('change'));
    Object.assign(o, { bw2: S.sec.bw, n2: S.layers[0].n, phiMn2: CC.combos[0].phiMn, ro: document.querySelector('[data-fkey="bw"]').readOnly, bm: JSON.parse(localStorage.getItem('rcbeam_v2_auto')).slab.bMode }); return o; });
  ok(r.bw === 48 && r.n === 4 && near(r.phiMn, 33.603, 0.001) && r.same, 'reopened from the save: b = 48, n = 4, φM_n 33.60, save unchanged');
  ok(r.bw2 === 12 && r.n2 === 1 && near(r.phiMn2, 8.40, 0.005) && r.ro && r.bm === undefined, 'back to per 1 ft strip: b = 12 (locked), n = 1, φM_n 8.40, no bMode saved');
  r = await f.evaluate(() => { const s = document.querySelector('[data-fkey="memberType"]'); s.value = 'beam'; s.dispatchEvent(new Event('change')); return { mt: S.memberType, L: S.layers[0] }; });
  ok(r.mt === 'beam' && r.L.n === 1 && r.L.s === undefined, 'back to beam: integer bars, no spacing');
  ok(!errs.length, 'console errors: ' + errs.length + (errs.length ? ' ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
}
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
