#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), BARG (2026-11-24): "Barrier weight from: Geometry" (shared/barrier.js) in the page. Headless Chromium,
// file://. A made-up bridge: a new project (DC2 distributed), both deck edges a 12 in × 42 in rectangular barrier.
//   1. Cross-section tab: Geometry, b 12, h 42 (real change events) on both edges: weight 0.5250 klf, width 1.000 ft, x̄ 0.500 ft read-only,
//      a sketch and the worked steps; the project keeps bMode / bDims and the computed w, bw.
//   2. Loads & LLDF tab: step dl.load.barL works 504.00/144(0.150) = 0.5250 klf; DC2 per line = the project with 0.525 klf and 1.00 ft typed.
//   3. Back to Entered: the typed fields. Only psb2.* keys written; 0 console errors.
//   node tests/smoke/ps-bridge-barrier.mjs [--shot <png>]
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const ai = process.argv.indexOf('--shot'), SHOT = ai > 0 ? process.argv[ai + 1] : null;
const { b, p, errs } = await openPage(path.join(REPO, 'apps/ps-bridge/index.html'), { vw: 1500, vh: 1100, dsf: 2 });
const otab = t => p.evaluate(t => document.querySelector(`#tabBar [data-otab="${t}"]`).click(), t);
const itab = t => p.evaluate(t => document.querySelector(`#inTabs [data-itab="${t}"]`).click(), t);
const q = s => '[data-path="' + s + '"]';
const change = async (sel, v, isSel) => { if (isSel) await p.selectOption(sel, v); else { await p.fill(sel, String(v)); await p.dispatchEvent(sel, 'change'); } await p.waitForTimeout(300); };
try {
  await p.waitForSelector('#tabBar [data-otab]');
  await p.evaluate(() => { localStorage.clear(); const P = PSBModel.newProject(); P.project.name = 'Barrier geometry smoke (made-up bridge)';
    localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); });
  await p.reload(); await p.waitForSelector('#tabBar [data-otab]'); await p.waitForTimeout(400);
  await itab('xsec'); await p.waitForSelector('#card-dl');
  for (const s of ['L', 'R']) {
    await change(q(`xs.dl.bar${s}.bMode`), 'geom', true); await p.waitForSelector(q(`xs.dl.bar${s}.bDims.h`));
    await change(q(`xs.dl.bar${s}.bDims.b`), 12); await change(q(`xs.dl.bar${s}.bDims.h`), 42);
  }
  const ro = await p.evaluate(() => [...document.querySelectorAll('#card-dl input[readonly][title="Computed from the barrier geometry"]')].map(e => e.value));
  assert.deepEqual(ro, ['0.5250', '1.000', '0.500', '0.5250', '1.000', '0.500'], JSON.stringify(ro));
  assert.equal(await p.evaluate(() => document.querySelectorAll('#card-dl svg[aria-label="Barrier cross-section sketch"]').length), 2);
  const sv = await p.evaluate(() => JSON.parse(localStorage.getItem('psb2.project.current')).xs.dl.barL);
  assert.equal(sv.bMode, 'geom'); assert.deepEqual(sv.bDims, { b: 12, h: 42 }); assert.equal(sv.w, 0.525); assert.equal(sv.bw, 1);
  console.log('  ok   Geometry 12 × 42 in both edges: 0.5250 klf, 1.000 ft, x̄ 0.500 ft read-only, sketched, worked; saved bMode / bDims and w, bw');
  if (SHOT) { const el = await p.$('#card-dl'); await el.screenshot({ path: SHOT }); }
  await otab('lds');
  await p.waitForFunction(() => document.getElementById('st-dl.load.barL'), null, { timeout: 120000 });
  const st = await p.evaluate(() => document.getElementById('st-dl.load.barL').textContent);
  assert.match(st, /504\.00/); assert.match(st, /0\.5250/);
  const cmp = await p.evaluate(() => { const raw = localStorage.getItem('psb2.project.current'), P = PSBModel.importJSON(raw).project, Pe = PSBModel.importJSON(raw).project;
    ['L', 'R'].forEach(s => { delete Pe.xs.dl['bar' + s].bMode; Pe.xs.dl['bar' + s].w = 0.525; Pe.xs.dl['bar' + s].bw = 1; });
    return { g: PSBBridgeDL.distribute(P).dc2, e: PSBBridgeDL.distribute(Pe).dc2 }; });
  cmp.e.forEach((v, i) => assert.ok(Math.abs(cmp.g[i] - v) < 1e-12, `DC2 G${i + 1}: ${cmp.g[i]} vs ${v}`));
  console.log(`  ok   Loads & LLDF: dl.load.barL worked; DC2 per line ${cmp.g.map(v => v.toFixed(4)).join(', ')} klf = typed 0.525 klf / 1.00 ft`);
  await itab('xsec'); await p.waitForSelector('#card-dl');
  await change(q('xs.dl.barL.bMode'), 'entered', true); await p.waitForSelector(q('xs.dl.barL.w'));
  assert.equal(await p.$eval(q('xs.dl.barL.w'), e => +e.value), 0.525);
  console.log('  ok   back to Entered: the typed fields, holding the last computed values');
  const keys = await p.evaluate(() => Object.keys(localStorage)); assert.ok(keys.every(k => /^psb2\./.test(k)), JSON.stringify(keys));
  assert.deepEqual(errs, [], 'console errors');
  console.log('  ok   psb2.* keys only; 0 console errors');
} finally { await b.close(); }
