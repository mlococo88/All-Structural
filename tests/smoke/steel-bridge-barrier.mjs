#!/usr/bin/env node
// Browser smoke test of "Barrier weight from: Geometry" (BARG, 2026-11-24; shared/barrier.js, ui/loads.js), headless Chromium (tests/lib.mjs):
//   1. Cross-section tab, both deck edges: Geometry, a rectangle 12 in × 42 in (a made-up project): the width at the deck 1.000 ft, the weight
//      0.5250 klf and the centroid 0.500 ft shown read-only, worked beside the inputs with a sketch.
//   2. The Loads & LLDF tab works the barrier (step dl.load.barL: 504.00/144(0.150) = 0.5250 klf) and its DC2 per girder equals the project
//      with 1.00 ft and 0.525 klf typed (Entered).
//   3. Back to Entered: the typed fields again. 0 console errors.
//   node tests/smoke/steel-bridge-barrier.mjs [--shot <png>]
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';
import { SBD_SEED } from './sbd-seed.mjs';

const ai = process.argv.indexOf('--shot'), SHOT = ai > 0 ? process.argv[ai + 1] : null;
const { b, p, errs } = await openPage(path.join(REPO, 'apps/steel-bridge/index.html'), { vw: 1500, vh: 1100, dsf: 2, ls: { ...SBD_SEED } });
const q = s => s.replace(/\./g, '\\.');
const setNum = async (id, v) => { await p.fill('#' + q(id), String(v)); await p.$eval('#' + q(id), e => e.dispatchEvent(new Event('change', { bubbles: true }))); };
try {
  await p.click('#inTabs [data-itab="xsec"]');
  for (const sd of ['L', 'R']) {
    await p.selectOption(`#${q(`i_xs.edges.${sd}.bMode`)}`, 'geom');
    await p.waitForSelector(`#${q(`i_xs.edges.${sd}.bDims.h`)}`);
    await setNum(`i_xs.edges.${sd}.bDims.b`, 12); await setNum(`i_xs.edges.${sd}.bDims.h`, 42);
  }
  const ro = await p.evaluate(() => [...document.querySelectorAll('#inPanes input[readonly]')].map(e => e.value));
  assert.deepEqual(ro, ['1.000', '0.5250', '0.500', '1.000', '0.5250', '0.500'], JSON.stringify(ro));
  assert.equal(await p.evaluate(() => document.querySelectorAll('#inPanes svg[aria-label="Barrier cross-section sketch"]').length), 2);
  assert.match(await p.evaluate(() => document.querySelector('#inPanes').textContent), /504\.00\/144\(0\.150\) = 0\.5250 klf|504\.00/);
  console.log('  ok   Geometry 12 × 42 in both sides: 1.000 ft, 0.5250 klf, x̄ 0.500 ft shown read-only, worked, sketched');
  if (SHOT) { const el = await p.$('#inPanes'); await el.screenshot({ path: SHOT }); }
  await p.click('#tabBar [data-otab="loads"]');
  await p.waitForFunction(() => document.getElementById('st-dl.load.barL'), null, { timeout: 120000 });
  const st = await p.evaluate(() => document.getElementById('st-dl.load.barL').textContent + ' | ' + (document.getElementById('st-dl.load.barL.geo.A') || {}).textContent);
  assert.match(st, /0\.5250/); assert.match(st, /504\.00/);
  // DC2 per girder = typing the computed values (engine, in the page)
  const cmp = await p.evaluate(() => { const LD = window.SBDLoads, raw = localStorage.getItem(window.SBDModel.KEYS.current), P = JSON.parse(raw), run = P => { const { b, p } = LD.fromModel(P, { girder: 0 }); return LD.compute(b, p).dead.dc2; };
    const Pe = JSON.parse(raw); ['L', 'R'].forEach(s => { delete Pe.xs.edges[s].bMode; Pe.xs.edges[s].bw = 1; Pe.xs.edges[s].bwt = 0.525; });
    return { g: run(P), e: run(Pe) }; });
  cmp.e.forEach((v, i) => assert.ok(Math.abs(cmp.g[i] - v) < 1e-12, `DC2 G${i + 1}: ${cmp.g[i]} vs ${v}`));
  console.log(`  ok   Loads & LLDF: dl.load.barL worked; DC2 per girder ${cmp.g.map(v => v.toFixed(4)).join(', ')} klf = typed 1.00 ft / 0.525 klf`);
  await p.click('#inTabs [data-itab="xsec"]');
  await p.selectOption(`#${q('i_xs.edges.L.bMode')}`, 'entered');
  await p.waitForSelector(`#${q('i_xs.edges.L.bwt')}`);
  assert.equal(await p.$eval(`#${q('i_xs.edges.L.bwt')}`, e => +e.value), 0.525);
  console.log('  ok   back to Entered: the typed fields, holding the last computed values');
  assert.deepEqual(errs, [], 'console errors');
  console.log('  ok   0 console errors');
} finally { await b.close(); }
