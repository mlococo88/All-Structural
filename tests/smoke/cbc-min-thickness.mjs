#!/usr/bin/env node
// CBMH (2026-11-13): Concrete Beam Capacity, Beam Capacity tab, ACI mode: minimum thickness, ACI 318-19 Table 9.3.1.1 (beam) and
// Table 7.3.1.1 (one-way slab), at 1400 and 390 px, file://, 0 console errors. Hand checks:
//   slab h 9 in, span 12 ft simply supported: h_min = 144/20 = 7.20 in <= 9 PASS (h 7: FAIL)
//   beam h 18 in, span 20 ft both ends continuous: 240/21 = 11.43 in PASS; f_y 80 ksi: x (0.4 + 0.8) = 13.71 in
//   beam cantilever 10 ft: 120/8 = 15.00 in PASS; lightweight (λ 0.85), w_c not entered (90 pcf): x max(1.65 − 0.45, 1.09) = 1.20 -> 18.00 in PASS (= h)
//   span blank: N/A "not checked" (not PASS); an older save has no span. AASHTO mode: no row.
//   node tests/smoke/cbc-min-thickness.mjs [--file <Concrete Beam Capacity.html>]
import path from 'path';
import { openPage, REPO } from '../lib.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FILE = path.resolve(arg('file', path.join(REPO, 'Concrete Beam Capacity.html')));
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const near = (a, b, t) => Math.abs(a - b) <= t;
const ST = { proj: { name: 'MH' }, code: 'ACI', loadMode: 'factored', sec: { type: 'rect', bw: 12, h: 18 }, mat: { fc: 4, fy: 60, fyt: 60, lambda: 1 }, tor: { present: false },
  layers: [{ n: 3, size: '6', face: 'tension', dMan: null }], combos: [{ name: 'U', Mu: 50, Vu: 10, Tu: 0 }] };
for (const vw of [1400, 390]) {
  console.log('--- viewport ' + vw + ' px');
  const { b, p, errs } = await openPage(FILE, { hash: '#capacity', vw, vh: 900, ls: { rcbeam_v2_auto: JSON.stringify(ST) } });
  const f = await (await p.$('#suite-frame-capacity')).contentFrame();
  await f.waitForFunction(() => typeof computeAll === 'function' && typeof CC !== 'undefined' && CC, null, { timeout: 30000 });
  const mh = (set) => f.evaluate(st => { new Function('st', st)(null); refresh(); const d = CC.combos[0].det.find(x => x.id === 'dMinH'); return d ? { have: d.have, need: d.need, ok: d.ok, na: d.na, why: d.naWhy, ref: d.ref } : null; }, set);
  let r = await mh('');
  ok(r && r.na && /not checked/i.test(r.why) && r.ref === 'ACI 9.3.1.1, Table 9.3.1.1', 'older save (no span): N/A "not checked" (Table 9.3.1.1)');
  r = await mh('S.minh.span=20; S.minh.sup="both";'); ok(r && near(r.need, 240 / 21, 1e-9) && r.ok, `beam 20 ft both ends continuous: h_min ${r.need.toFixed(2)} (11.43) PASS`);
  r = await mh('S.mat.fy=80;'); ok(near(r.need, 240 / 21 * 1.2, 1e-9), `f_y 80 ksi: × 1.20 -> ${r.need.toFixed(2)} (13.71)`);
  r = await mh('S.mat.fy=60; S.minh.span=10; S.minh.sup="cant";'); ok(near(r.need, 15, 1e-9) && r.ok, `cantilever 10 ft: ${r.need.toFixed(2)} (15.00) PASS`);
  r = await mh('S.mat.lambda=0.85;'); ok(near(r.need, 18, 1e-9) && r.ok, `lightweight, w_c not entered (90 pcf): × 1.20 -> ${r.need.toFixed(2)} (18.00) PASS`);
  r = await mh('S.minh.wc=110;'); ok(near(r.need, 15 * 1.10, 1e-9), `w_c 110 pcf: × max(1.10, 1.09) -> ${r.need.toFixed(2)} (16.50)`);
  // slab
  r = await f.evaluate(() => { S.mat.lambda = 1; S.minh.wc = 0; const s = document.querySelector('[data-fkey="memberType"]'); s.value = 'slab'; s.dispatchEvent(new Event('change'));
    S.sec.h = 9; S.minh.span = 12; S.minh.sup = 'simple'; refresh(); const d = CC.combos[0].det.find(x => x.id === 'dMinH'); return { need: d.need, ok: d.ok, ref: d.ref }; });
  ok(near(r.need, 7.2, 1e-9) && r.ok && r.ref === 'ACI 7.3.1.1, Table 7.3.1.1', `slab 12 ft simply supported: h_min ${r.need.toFixed(2)} (7.20) ≤ 9 PASS (Table 7.3.1.1)`);
  r = await mh('S.sec.h=7;'); ok(!r.ok, 'slab h 7 < 7.20: FAIL');
  r = await f.evaluate(() => { const c = cbcDashItems().find(x => /Minimum slab thickness/.test(x.name)); S.ui.tab = 'tabDetail'; refresh(); const card = (document.querySelector('#detdMinH') || {}).innerText || '';
    const t = SharedReport.text(SharedReport.build(mrModel()), { legacy: true }); return { c: !!c && c.st === 'fail', card: /7\.20/.test(card) && /partitions/.test(card), t: /Minimum slab thickness/.test(t) && /7\.3\.1\.1/.test(t) && !/NaN|undefined|\[\[/.test(t) }; });
  ok(r.c && r.card && r.t, 'check summary FAIL row, Detailing card (7.20, the partitions assumption), Report');
  r = await mh('S.code="AASHTO";'); ok(!r, 'AASHTO mode: no row');
  const sw = await f.evaluate(() => { S.code = 'ACI'; refresh(); return document.documentElement.scrollWidth - document.documentElement.clientWidth; });
  ok(sw <= 1, 'no sideways scroll (' + sw + ')');
  ok(!errs.length, 'console errors: ' + errs.length + (errs.length ? ' ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
}
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
