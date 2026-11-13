#!/usr/bin/env node
// CBTS (2026-11-13): Concrete Beam Capacity, one-way slab: the shrinkage and temperature (T&S) bars entered in Reinforcement input 5
// are drawn on every sketch and sheet that shows the slab reinforcement. Slab h 9 in, #5 @ 12 in bottom (auto d), c_c 0.75 in, no stirrups,
// T&S #4 @ 12 in. Placement: on the bottom bars, centre at y = yTop(main) − d_b,main/2 − d_b,T&S/2 = (9 − 0.75 − 0.3125) − 0.3125 − 0.25
// = 7.375 in from the top; d of the main layer unchanged (8.25 − 0.3125 = 7.9375 in). Checked:
//  - cross-section sketch (Input Echo, Visuals, Report overview): a bar line across the width (x = ±(6 − 0.75)) at y 7.375, labelled
//    "#4 @ 12.00 in T&S (transverse)";
//  - elevation along the span (Input Echo, Visuals, Report overview; there was none for a slab without stirrups): T&S bars as circles at 12 in;
//  - 3-D view: T&S bars across the width at 12 in along the length;
//  - drawing sheets / DXF: section (bar along the cut + callout), elevation (bars cut, at s, dimensioned), bar schedule row TS;
//  - d, A_s, φM_n and every check identical with and without the T&S bars entered;
//  - a top-bars-only slab: the T&S bar under the top bars.
// 1400 and 390 px, file://, 0 console errors.
//   node tests/smoke/cbc-slab-st-drawings.mjs [--file <Concrete Beam Capacity.html>] [--shots <dir>]
import path from 'path';
import { openPage, REPO } from '../lib.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FILE = path.resolve(arg('file', path.join(REPO, 'Concrete Beam Capacity.html')));
const SHOTS = arg('shots', null);
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const near = (a, b, t) => Math.abs(a - b) <= t;
const SLAB = { proj: { name: 'Slab T&S' }, code: 'ACI', memberType: 'slab', loadMode: 'factored', sec: { type: 'rect', bw: 12, h: 9 }, mat: { fc: 4, fy: 60, fyt: 60 },
  cover: { cc: 0.75, req: 0.75, exposure: 'interior', userEdited: true }, tor: { present: false }, stir: { present: false, size: '4', legs: 2, s: 6 },
  layers: [{ n: 1, s: 12, size: '5', face: 'tension', dMan: null }], slab: { stSize: '4', stS: 12 }, combos: [{ name: 'U', Mu: 6, Vu: 3, Tu: 0 }] };
for (const vw of [1400, 390]) {
  console.log('--- viewport ' + vw + ' px');
  const { b, p, errs } = await openPage(FILE, { hash: '#capacity', vw, vh: 900, ls: { rcbeam_v2_auto: JSON.stringify(SLAB) } });
  const f = await (await p.$('#suite-frame-capacity')).contentFrame();
  await f.waitForFunction(() => typeof computeAll === 'function' && typeof CC !== 'undefined' && CC, null, { timeout: 30000 });
  await p.waitForTimeout(800);
  let r = await f.evaluate(() => { const ST = cbcStBars(), G = layerGeom(false); return { ST: ST && { yTop: ST.yTop, x0: ST.x0, x1: ST.x1, up: ST.up, txt: ST.txt }, d: G[0].d, yTop: G[0].yTop, As: CC.combos[0].F.As, phiMn: CC.combos[0].phiMn, CC: JSON.stringify(CC), V: JSON.stringify(VALIDATION) }; });
  ok(r.ST && near(r.ST.yTop, 7.375, 1e-9) && r.ST.up && near(r.ST.x0, -5.25, 1e-9) && near(r.ST.x1, 5.25, 1e-9) && r.ST.txt === '#4 @ 12.00 in T&S (transverse)',
    `T&S bar on the bottom bars at y ${r.ST && r.ST.yTop} in from the top (7.375), across x = ±5.25 in; "${r.ST && r.ST.txt}"`);
  ok(near(r.d, 7.9375, 1e-9), `main layer d ${r.d} in (8.25 − 0.3125 = 7.9375): the T&S bars are inside the main bars`);
  const withST = r;
  r = await f.evaluate(() => { const st = S.slab.stSize; S.slab.stSize = ''; refresh(); const o = { d: layerGeom(false)[0].d, CC: JSON.stringify(CC), V: JSON.stringify(VALIDATION), ST: cbcStBars(), sec: svgSection(false), el: svgElevation() }; S.slab.stSize = st; refresh(); return o; });
  const strip = s => s.replace(/"dSt[AS]".*?\}/g, '');
  ok(r.d === withST.d && !r.ST && !/0E7490/.test(r.sec) && r.el === null, 'without T&S: the same d, no T&S drawn, no slab elevation (as before)');
  ok(JSON.parse(r.CC).combos.map(c => c.phiMn + '/' + c.F.As).join() === JSON.parse(withST.CC).combos.map(c => c.phiMn + '/' + c.F.As).join(), 'φM_n and A_s identical with and without T&S entered');
  // sketches
  r = await f.evaluate(() => { const sec = svgSection(false), el = svgElevation();
    S.ui.tab = 'tabInputEcho'; refresh(); const ie = document.getElementById('tabPages').innerHTML;
    S.ui.tab = 'tabVisuals'; refresh(); const vis = document.getElementById('tabPages').innerHTML, visT = document.getElementById('tabPages').innerText;
    const ov = cbcOvFigs(); const rpt = SharedReport.text(SharedReport.build(mrModel()), { legacy: true });
    return { secLine: /<line [^>]*stroke="#0E7490"/.test(sec), secTxt: /#4 @ 12\.00 in T&amp;S \(transverse\)/.test(sec), elC: el ? (el.match(/<circle [^>]*fill="#0E7490"/g) || []).length : 0,
      elTxt: el && /resting on the bottom bars/.test(el), ie: /0E7490/.test(ie) && /shrinkage and temperature bars \(transverse\)/.test(ie), vis: /0E7490/.test(vis) && /One-way slab elevation along the span: #4 @ 12\.00 in T&S/.test(visT),
      ov: !!(ov && ov.elev && ov.st), rpt: /Elevation of a short run of the one-way slab along the span/.test(rpt) && /#4 @ 12\.00 in T&S \(transverse\)/.test(rpt), bad: /NaN|undefined|\[\[/.test(rpt) }; });
  ok(r.secLine && r.secTxt, 'cross-section sketch: T&S bar line and label');
  ok(r.elC >= 4 && r.elTxt, `slab elevation along the span: ${r.elC} T&S bars at 12 in, inside the main bars`);
  ok(r.ie && r.vis, 'Input Echo schematic and Visuals elevation with caption');
  ok(r.ov && r.rpt && !r.bad, 'Report overview: slab elevation figure with T&S caption; no NaN or unresolved link');
  // 3-D
  r = await f.evaluate(() => { if (!window.THREE) return { na: true }; const o = cbc3DScene(false, 0.45, {}); let n = 0; o.gStir.children.forEach(m => { if (m.material && m.material.color && m.material.color.getHex() === 0x0e7490) n++; }); return { n, Lb: o.Lb }; });
  ok(r.na || r.n === Math.floor(r.Lb / 12) + 1, r.na ? '3-D: three.js not loaded (skipped)' : `3-D view: ${r.n} T&S bars across the width (L ${r.Lb} in at 12 in)`);
  // drawing sheets / DXF
  r = await f.evaluate(() => { const B = cbdwBuild(), dxf = B.D.toDXF({ ltscale: 1 });
    return { sec: /#4 @ 12" T&S \(TRANSVERSE\), ON THE BOTTOM BARS/.test(dxf), cut: /#4 @ 12" T&S \(TRANSVERSE\) \(CUT\)/.test(dxf), ts: /SHRINKAGE & TEMPERATURE \(TRANSVERSE\), ON THE BOTTOM BARS/.test(dxf), dim: /T&S/.test(dxf), valid: SharedDxf.validate(dxf).ok }; });
  ok(r.sec && r.cut && r.ts && r.valid, 'DXF (structure check ok): section callout "#4 @ 12" T&S (TRANSVERSE), ON THE BOTTOM BARS", elevation "(CUT)", bar schedule row TS ' + JSON.stringify(r));
  if (SHOTS) {
    await f.evaluate(() => { S.ui.tab = 'tabInputEcho'; refresh(); }); await p.waitForTimeout(300);
    const sc = await f.$('#ieSchematic'); if (sc) { await sc.scrollIntoViewIfNeeded(); await sc.screenshot({ path: path.join(SHOTS, `st-inputecho-${vw}.png`) }); }
    await f.evaluate(() => { S.ui.tab = 'tabDrawings'; refresh(); }); await p.waitForTimeout(800);
    const dw = await f.$('#tabPages'); if (dw) await dw.screenshot({ path: path.join(SHOTS, `st-drawings-${vw}.png`) });
  }
  // top bars only: under the top bars
  r = await f.evaluate(() => { S.layers[0].face = 'compression'; refresh(); const ST = cbcStBars(), G = layerGeom(false); const o = { up: ST.up, y: ST.yTop, yT: G[0].yTop }; S.layers[0].face = 'tension'; refresh(); return o; });
  ok(!r.up && near(r.y, r.yT + 0.3125 + 0.25, 1e-9), `top bars only: T&S under them at y ${r.y} (= ${r.yT} + 0.3125 + 0.25)`);
  ok(!errs.length, '0 console errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
}
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
