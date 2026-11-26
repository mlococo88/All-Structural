#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), HCT (engineer 2026-11-26: the camber tolerance, ± % of the predicted camber, a Settings input; for now
// on the Cross-section tab, Deck and haunch): headless Chromium, file://. The HP test design (NEXT 24F, 45 ft, t_h 2 in) with p = 10 %:
//   1. the input is on the Cross-section tab; 2. the Camber & deflection tab's card #card-cbtol: predicted, high and low camber rows (haunch
//   at midspan 2.00 / 1.63 / 2.37 in; at the bearings 5.35 / 5.72 / 4.97 in) with § links to the steps; 3. without it, no card; 0 console errors.
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.join(REPO, 'apps/ps-bridge/index.html');
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, p, errs } = await openPage(FILE, { vw: 1280, vh: 1000, dsf: 1 });
const tab = async t => { await p.click(`#tabBar [data-otab="${t}"]`); await p.waitForTimeout(800); };
const seed = tol => p.evaluate(tol => { localStorage.clear(); const P = PSBModel.newProject(); P.base.girder = 'NEXT 24F'; P.spans.lengths = [45]; P.xs.bays = P.xs.bays.map(() => 10);
  P.base.ts = 8; P.base.th = 2; P.base.rows = [{ n: 16, y: 2.875, dbnd: 0, nd: 0 }, { n: 16, y: 4.875, dbnd: 0, nd: 0 }, { n: 12, y: 6.875, dbnd: 0, nd: 0 }]; P.base.harp.n = 0;
  P.base.loads.wNC = 0; P.base.loads.wBar = 0.5; P.base.loads.wDW = 0.3; if (tol != null) P.base.opt.camTol = tol; localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); }, tol);
try {
  await p.waitForSelector('#tabBar [data-otab]');
  await seed(10); await p.reload(); await p.waitForSelector('#tabBar [data-otab]', { timeout: 90000 });
  await p.click('#inTabs [data-itab="xsec"]'); await p.waitForTimeout(600);
  assert.ok(await p.evaluate(() => !!document.querySelector('[data-p="base.opt.camTol"], [data-path="base.opt.camTol"], [name="base.opt.camTol"]') || document.body.innerText.includes('Camber tolerance (± % of the predicted camber)')), 'the input');
  ok('the input on the Cross-section tab');
  await tab('camb'); await p.waitForSelector('#card-cbtol');
  const r = await p.evaluate(() => { const c = document.querySelector('#card-cbtol'), rows = [...c.querySelectorAll('tbody tr')].map(tr => [...tr.cells].map(td => td.innerText.replace(/\s*§\s*/g, '').trim()));
    return { rows, links: [...c.querySelectorAll('a.wk')].map(a => a.getAttribute('href')) }; });
  assert.deepEqual(r.rows.map(q => [q[2], q[3]]), [['2.00', '5.35'], ['1.63', '5.72'], ['2.37', '4.97']], JSON.stringify(r.rows));
  ['#st-cb.tolC', '#st-cb.tol.hi.mid', '#st-cb.tol.hi.brg', '#st-cb.tol.lo.mid', '#st-cb.tol.lo.brg'].forEach(h => assert.ok(r.links.includes(h), h));
  ok('the card: predicted 2.00 / 5.35, high 1.63 / 5.72, low 2.37 / 4.97 in, with § links');
  await seed(null); await p.reload(); await p.waitForSelector('#tabBar [data-otab]', { timeout: 90000 }); await tab('camb'); await p.waitForSelector('#card-cbhaunch');
  assert.equal(await p.evaluate(() => !!document.getElementById('card-cbtol')), false); ok('no tolerance entered: no card');
  assert.deepEqual(errs, [], 'console errors'); ok('0 console errors');
  console.log(`\n${n} passed`);
} finally { await b.close(); }
