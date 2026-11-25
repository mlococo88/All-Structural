#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html) batch G7 / G9 (2026-11-15), headless Chromium, file://:
//   G7 the End zone tab of a box beam and of a voided slab: the "Splitting steel orientation" graphic (end face + end region, h/4 dimension;
//      box: vertical legs in the webs, slab: horizontal bars across the width); none for the default I-girder.
//   G9 "↩ MCT Analysis" was removed 2026-11-25 (NOMCT, engineer's request "no MCT input or output"): no such button in the header, even
//      with #from=mct. 0 console errors.
//   node tests/smoke/ps-bridge-gsplitmct.mjs [--shots <dir>]
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const shots = (i => i > 0 ? process.argv[i + 1] : null)(process.argv.indexOf('--shots'));
let n = 0; const ok = m => { n++; console.log('  ok  ', m); }; const t0 = Date.now();
const FILE = path.join(REPO, 'apps/ps-bridge/index.html');
const ready = p => p.waitForFunction(() => window.PSBUiEndZone && document.getElementById('out').innerText.length > 50, null, { timeout: 120000 });
let { b, p, errs } = await openPage(FILE, { vw: 1400, vh: 1000 });
try {
  await ready(p);
  assert.equal(await p.locator('#bMct').count(), 0); assert.ok(!/MCT/i.test(await p.innerText('#hdr'))); ok('no "↩ MCT Analysis" in the header (NOMCT)');
  await p.click('#tabBar [data-otab="end"]'); await p.waitForTimeout(300);
  assert.equal(await p.locator('#gfx_ezsplit').count(), 0); ok('PCI BT-72: no orientation graphic');
  for (const [girder, tag, re] of [['AASHTO BIII-36 (39in)', 'box', /Side view of the end region/], ['AASHTO SIV-48 (21in)', 'slab', /Plan of the end region/]]) {
    await p.evaluate(g => { const P = PSBModel.load(localStorage).project; P.base.girder = g; P.base.ts = 6; P.base.harp = { n: 0, yEnd: 8, yMid: 4, frac: 0.4 }; P.base.rows = [{ n: 10, y: 2, nd: 0, dbnd: 0 }];
      if (P.types) P.types.forEach(t => { if (t.ovr) { delete t.ovr.girder; delete t.ovr.rows; delete t.ovr.harp; delete t.ovr.ts; } }); PSBModel.save(localStorage, P); }, girder);
    await p.reload(); await ready(p); await p.click('#tabBar [data-otab="end"]'); await p.waitForSelector('#gfx_ezsplit svg');
    const t = await p.textContent('#gfx_ezsplit'); assert.match(t, re); assert.match(t, /h\/4 = [\d.]+ in/); assert.match(t, tag === 'slab' ? /horizontal, within h\/4 of the end, h = the overall width/ : /vertical reinforcement in the webs/);
    ok(`${girder}: the orientation graphic (${tag})`);
    if (shots) await p.locator('#gfx_ezsplit').screenshot({ path: path.join(shots, `G7-split-${tag}.png`) });
  }
  assert.deepEqual(errs, []); ok('0 console errors');
  console.log(`ps-bridge-gsplitmct: ${n} checks passed (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
} finally { await b.close(); }
