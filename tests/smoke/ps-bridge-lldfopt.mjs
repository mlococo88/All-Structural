#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), LL-O and IMP-N (2026-11-23) in the page. Headless Chromium, file://, the CDN libraries from
// tests/libs. A made-up bridge: a new project (5 girders at 9 ft, one 120 ft span) with both supports skewed 30 degrees.
//   1. Cross-section tab: the card "Live-load distribution options" with the Steel Bridge app's two selects, both off; a new project stores
//      no xs.lldf;
//   2. "Shear skew correction: Exterior girders only" chosen (a real change event): saved as xs.lldf.skewV 'ext'; on the Loads & LLDF tab
//      the interior girder shown takes DF_V = g_V = 0.8839 (0.9571 before), the row and the worked step ld.lo.cV are on the tab;
//   3. "Exterior not less than interior: Yes", the exterior girder G1 shown: DF_V raised (policy), the rows and the steps ld.lo.*; the
//      Report's assumptions name both options and its loads section has the steps;
//   4. both set back: the factors of the start; IMP-N: every girder type on a custom demand table with a pedestrian load: the note on the
//      Cross-section tab, in the source line of the output tabs, on the Loads & LLDF tab and in the Report;
//   5. the keys written are psb2.* only; 0 console errors. SHOT=<dir> saves the input card and the Loads & LLDF card.
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.join(REPO, 'apps/ps-bridge/index.html'), SHOT = process.env.SHOT;
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, p, errs } = await openPage(FILE, { vw: 1400, vh: 1000 });
const otab = t => p.evaluate(t => document.querySelector(`#tabBar [data-otab="${t}"]`).click(), t);
const itab = t => p.evaluate(t => document.querySelector(`#inTabs [data-itab="${t}"]`).click(), t);
const until = async (f, ms, w) => { const t0 = Date.now(); for (;;) { if (await f()) return; if (Date.now() - t0 > ms) throw new Error('timeout: ' + w); await new Promise(r => setTimeout(r, 200)); } };
const shot = async (sel, name) => { if (!SHOT) return; const el = await p.$(sel); if (el) await el.screenshot({ path: path.join(SHOT, name) }); };
const stored = () => p.evaluate(() => JSON.parse(localStorage.getItem('psb2.project.current')));
const calc = () => p.evaluate(() => { const P = PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, i = PSBDesign.inputs(P), R = PSBHoldDown.compute(JSON.parse(JSON.stringify(i))); return { dfm: R.dfm, dfv: R.dfv, VLL: R.VLL, lldf: i.lldf || null, pos: i.loads.pos, opt: R.df.opt || null, imp: R.imp || null, warns: R.warns }; });
const reload = async () => { await p.reload(); await p.waitForSelector('#tabBar [data-otab]'); await p.waitForTimeout(400); };
const near = (a, b2, t, m) => assert.ok(Math.abs(a - b2) <= t, `${m}: ${a} vs ${b2}`);
try {
  await p.waitForSelector('#tabBar [data-otab]');
  await p.evaluate(() => { localStorage.clear(); const P = PSBModel.newProject(); P.project.name = 'LLDF options smoke (made-up bridge)'; P.xs.skews = [30, 30];
    localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); });
  await reload();
  // 1. the card, both off
  await itab('xsec'); await p.waitForSelector('#card-lldfopt');
  const c0 = await p.evaluate(() => ({ sk: document.querySelector('[data-lo="skewV"]').value, em: document.querySelector('[data-lo="extMin"]').value, labels: [...document.querySelectorAll('#card-lldfopt label')].map(l => l.textContent), opts: [...document.querySelectorAll('#card-lldfopt option')].map(o => o.textContent) }));
  assert.deepEqual(c0, { sk: 'all', em: 'false', labels: ['Shear skew correction', 'Exterior not less than interior'], opts: ['All girders', 'Exterior girders only', 'No', 'Yes'] });
  assert.equal((await stored()).xs.lldf, undefined); const r0 = await calc(); assert.equal(r0.lldf, null); assert.equal(r0.pos, 'interior'); near(r0.dfv, 0.95711, 1e-5, 'DF_V before');
  ok(`Cross-section tab: "Live-load distribution options", both off (the Steel Bridge app's labels); nothing stored; G2 DF_V ${r0.dfv.toFixed(4)}`);
  // 2. the shear skew correction on the exterior girders only
  await p.selectOption('[data-lo="skewV"]', 'ext'); await p.waitForTimeout(500);
  assert.deepEqual((await stored()).xs.lldf, { skewV: 'ext', extMin: false });
  const r1 = await calc(); near(r1.dfv, 0.88388, 1e-5, 'DF_V with the option'); assert.equal(r1.dfm, r0.dfm); assert.deepEqual(r1.lldf, { skewV: 'ext' });
  await itab('xsec'); await p.waitForSelector('#lldfOptNote'); assert.match(await p.evaluate(() => document.querySelector('#lldfOptNote').textContent), /On now: Shear skew correction: Exterior girders only/);
  await shot('#card-lldfopt', 'ps-lldfopt-inputs.png');
  await otab('lds'); await until(() => p.evaluate(() => !!document.querySelector('#loCV')), 60000, 'the option row');
  const l1 = await p.evaluate(() => ({ cv: document.querySelector('#loCV').textContent, step: document.getElementById('st-ld.lo.cV').textContent, dfv: document.getElementById('st-ld.dfv').textContent }));
  assert.equal(l1.cv, '1.0000'); assert.match(l1.step, /Exterior girders only/); assert.match(l1.step, /0\.9571/); assert.match(l1.dfv, /0\.8839/);
  ok(`"Exterior girders only": saved (xs.lldf.skewV 'ext'); interior G2 DF_V ${r0.dfv.toFixed(4)} → ${r1.dfv.toFixed(4)}, V_LL ${r0.VLL.toFixed(2)} → ${r1.VLL.toFixed(2)} kip; row and step ld.lo.cV on the Loads & LLDF tab`);
  // 3. exterior not less than interior, the exterior girder shown
  await itab('xsec'); await p.waitForSelector('[data-lo="extMin"]'); await p.selectOption('[data-lo="skewV"]', 'all'); await p.waitForTimeout(300);
  await itab('xsec'); await p.waitForSelector('[data-lo="extMin"]'); await p.selectOption('[data-lo="extMin"]', 'true'); await p.waitForTimeout(400);
  assert.deepEqual((await stored()).xs.lldf, { skewV: 'all', extMin: true });
  const e0 = await p.evaluate(() => { const P = PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project; P.design = { g: 1, s: 1 }; const Q = JSON.parse(JSON.stringify(P)); delete Q.xs.lldf;
    const i = PSBDesign.inputs(Q), R = PSBHoldDown.compute(JSON.parse(JSON.stringify(i))); localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); return { dfm: R.dfm, dfv: R.dfv, VLL: R.VLL, fat: R.fat.dfFat }; });
  await reload();
  const r2 = await calc(); assert.equal(r2.pos, 'exterior'); near(e0.dfv, 0.84222, 1e-5, 'exterior DF_V off'); near(r2.dfv, 0.95711, 1e-5, 'exterior DF_V on'); assert.equal(r2.dfm, e0.dfm); assert.equal(r2.opt.policyV, true);
  await otab('lds'); await until(() => p.evaluate(() => !!document.querySelector('#loInt')), 60000, 'the interior factor row');
  const l2 = await p.evaluate(() => ({ int: document.querySelector('#loInt').textContent, pol: document.querySelector('#loPol').textContent, steps: ['ld.lo.Sint', 'ld.lo.gMi', 'ld.lo.gVi', 'ld.lo.dfmI', 'ld.lo.dfvI', 'ld.lo.dfmE', 'ld.lo.dfvE'].map(id => !!document.getElementById('st-' + id)), dfv: document.getElementById('st-ld.dfv').textContent }));
  assert.equal(l2.int, '0.6907 / 0.9571'); assert.match(l2.pol, /raised to interior \(policy\)/); assert.deepEqual(l2.steps, l2.steps.map(() => true)); assert.match(l2.dfv, /0\.9571/);
  await shot('#card-lldfopt', 'ps-lldfopt-inputs2.png');
  if (SHOT) { const s = await p.$('#st-ld\\.lo\\.dfvI'); if (s) { const t = await s.evaluateHandle(e => e.closest('details') || e.parentElement); await t.asElement().screenshot({ path: path.join(SHOT, 'ps-lldfopt-steps.png') }); } }
  ok(`"Exterior not less than interior": exterior G1 DF_V ${e0.dfv.toFixed(4)} → ${r2.dfv.toFixed(4)} (interior ${l2.int}), DF_M unchanged ${r2.dfm.toFixed(4)}; 7 worked steps ld.lo.* on the tab`);
  await otab('rpt'); await until(() => p.evaluate(() => /Live-load distribution options/.test((document.querySelector('#rptHost') || {}).textContent || '')), 180000, 'the Report');
  const rp = await p.evaluate(() => { const t = document.querySelector('#rptHost').textContent; return { asm: /Live-load distribution options \(Cross-section tab\)/.test(t), name: /Exterior not less than interior \(owner \/ engineer policy/.test(t), step: /Interior girder, shear distribution factor/.test(t), used: /raised to the interior girder's factor \(policy\)/.test(t) }; });
  assert.deepEqual(rp, { asm: true, name: true, step: true, used: true }, JSON.stringify(rp));
  ok('Report: the assumptions name the option; the loads section has the interior-factor steps and the factor used');
  // 4. back to off: the start's factors; then imported demands with a pedestrian load
  await p.evaluate(() => { const P = PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project; P.xs.lldf = { skewV: 'all', extMin: false }; localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); });
  const r3 = await calc(); assert.equal(r3.lldf, null); near(r3.dfv, e0.dfv, 0, 'off again: DF_V as before'); near(r3.VLL, e0.VLL, 0, 'V_LL as before');
  ok(`both options off again (stored 'all' / false): no inputs.lldf, G1 DF_V ${r3.dfv.toFixed(4)} as before`);
  await p.evaluate(() => { const P = PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project; P.xs.dl.swL = { w: 6, t: 9 }; P.xs.dl.ped = 75;
    P.types.forEach(t => { PSBDemands.setSrc(P, t.id, 'table'); PSBDemands.setTable(P, t.id, [{ x: 0, V_LLneg: -90 }, { x: 60, M_LLpos: 2400, M_DC2: 300, M_DW: 200 }, { x: 120, V_LLpos: 90 }]); });
    localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); });
  await reload();
  const r4 = await calc(); assert.ok(r4.imp && r4.imp.pl > 0); assert.equal(r4.warns.filter(w => /pedestrian/i.test(w)).length, 1);
  await itab('xsec'); await p.waitForSelector('#impAssume'); const ia = await p.evaluate(() => document.querySelector('#impAssume').textContent);
  assert.match(ia, /used as given/); assert.match(ia, /imported live load must already include it; it is NOT added by this app/);
  await otab('lds'); await until(() => p.evaluate(() => !!document.querySelector('#impNote')), 60000, 'the imported-demands note');
  const l4 = await p.evaluate(() => ({ note: document.querySelector('#impNote').textContent, bar: (document.querySelector('#dmSrcBar') || {}).textContent || '', ext: (document.querySelector('#plExt') || {}).textContent || '', step: !!document.getElementById('st-ld.imp') }));
  assert.match(l4.note, /NOT added by this app/); assert.match(l4.bar, /used as given/); assert.match(l4.ext, /must already include the pedestrian load/); assert.ok(l4.step);
  await shot('#impNote', 'ps-imp-note.png');
  await otab('rpt'); await until(() => p.evaluate(() => /Imported demands \(a MIDAS file or a custom table\) are used as given/.test((document.querySelector('#rptHost') || {}).textContent || '')), 180000, 'the Report note');
  ok('IMP-N: imported demands + pedestrian load: the note on the Cross-section tab, the output source line, the Loads & LLDF tab (card, step ld.imp) and in the Report');
  const keys = await p.evaluate(() => Object.keys(localStorage)); assert.ok(keys.every(k => k.startsWith('psb2.')), 'keys ' + keys.join(', '));
  assert.deepEqual(errs, [], 'console errors: ' + errs.join(' | '));
  ok(`keys written: psb2.* only (${keys.length}); 0 console errors`);
  console.log(`ps-bridge-lldfopt: ${n} checks passed`);
} finally { await b.close(); }
