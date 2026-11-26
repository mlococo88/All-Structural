#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), EZNI (2026-11-25, display only): the End zone & hold-down tab works the concrete tensile force of
// the bonded release-tension steel (AASHTO LRFD 10th Ed. 5.9.2.3.1b) by parts, without an integral.
// Headless Chromium, file://, the CDN libraries from tests/libs. A MassDOT NEDBT 48 design (12 draped strands at y_end = 12 in, 12 strands
// in the third row), bonded release steel on (0.62 in²):
//   1. the card "Bonded release-tension steel" has the parts table (top tension: one part, the top flange) with the sum and the engine's T;
//   2. topic 3 (Bonded release-tension steel) expanded: the steps c_top, F_1, T_top = F_1; no integral sign or "240 strips" in an equation;
//      the D/C step red (NG) as before;
//   3. the Report has the same steps (no integral) and the parts table; 0 console errors.
//   SHOT=<file.png> node tests/smoke/ps-bridge-ez-noint.mjs   (a screenshot of the expanded topic 3 when SHOT is set)
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const SHOT = process.env.SHOT;
const FILE = path.join(REPO, 'apps/ps-bridge/index.html');
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, p, errs } = await openPage(FILE, { vw: 1280, vh: 1000, dsf: 1 });
const tab = async t => { await p.click(`#tabBar [data-otab="${t}"]`); await p.waitForTimeout(800); };
try {
  await p.waitForSelector('#tabBar [data-otab]');
  await p.evaluate(() => { localStorage.clear(); const P = PSBModel.newProject(); P.base.girder = 'MassDOT NEDBT 48'; P.base.harp.n = 12; P.base.harp.yEnd = 12; P.base.rows[2].n = 12;
    P.base.opt.relBondedReinf = true; P.base.opt.relAs = 0.62; localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); });
  await p.reload(); await p.waitForSelector('#tabBar [data-otab]', { timeout: 90000 }).catch(async e => { console.log('errs', errs, (await p.evaluate(() => document.body.innerText)).slice(0, 600)); throw e; });
  await tab('end');
  await p.waitForSelector('#card-ezrel');
  let r = await p.evaluate(() => { const c = document.querySelector('#card-ezrel'), rows = [...c.querySelectorAll('table.tbl tbody tr')].map(tr => tr.innerText.replace(/\s+/g, ' ').trim());
    return { rows, txt: c.innerText }; });
  assert.ok(r.rows.some(t => /^1\. top flange 0\.00 to \d+\.\d\d \d/.test(t)), JSON.stringify(r.rows));
  assert.ok(r.rows.some(t => /^T = ΣFi \d/.test(t)) && !/240 strips/.test(r.txt), JSON.stringify(r.rows));
  ok('card: the parts table (top flange) and T = ΣF_i (EZX: the engine\'s value)');
  const det = await p.$('details.sg-t[data-sgk="rel"]'); assert.ok(det, 'topic rel');
  await p.evaluate(() => { const d = document.querySelector('details.sg-t[data-sgk="rel"]'); d.open = true; d.dispatchEvent(new Event('toggle')); });
  await p.waitForTimeout(400);
  r = await p.evaluate(() => { const d = document.querySelector('details.sg-t[data-sgk="rel"]'), li = [...d.querySelectorAll('li[id^="st-ez.rel."]')];
    return { ids: li.map(x => x.id), txt: d.innerText, ng: !!d.querySelector('li#st-ez\\.rel\\.dc') && /NG|FAIL/.test(d.innerText), cls: d.className }; });
  ['st-ez.rel.Ttop.c', 'st-ez.rel.Ttop.p1', 'st-ez.rel.Ttop', 'st-ez.rel.Tbot', 'st-ez.rel.As', 'st-ez.rel.dc'].forEach(id => assert.ok(r.ids.includes(id), id + ' in ' + r.ids));
  assert.ok(!/∫|\\int|dy\b/.test(r.txt), 'no integral: ' + r.txt.slice(0, 400));
  assert.match(r.cls, /sg-ng/, 'topic NG (red) as before');
  ok(`topic 3 expanded: ${r.ids.length} steps, no integral, NG marking kept`);
  if (SHOT) { await p.setViewportSize({ width: 1280, height: 2400 });
    await (await p.$('details.sg-t[data-sgk="rel"]')).screenshot({ path: SHOT });
    await (await p.$('#card-ezrel')).screenshot({ path: SHOT.replace(/\.png$/, '-card.png') });
    ok('screenshots ' + SHOT); }
  await tab('rpt'); await p.waitForSelector('.rp-doc .rp-step', { timeout: 180000 }); await p.waitForTimeout(600);
  r = await p.evaluate(() => { const t = (document.querySelector('.rp-doc') || document.body).textContent.replace(/\s+/g, ' '); return { steps: /Tension zone, part 1: top flange/.test(t), tbl: /T = ΣF/.test(t), int: /∫|\\int/.test(t), t: t.slice(t.indexOf('Bonded release'), t.indexOf('Bonded release') + 1500) }; });
  assert.ok(r.steps && r.tbl, 'report has the by-parts steps and table: ' + JSON.stringify(r)); assert.ok(!r.int, 'report: no integral');
  ok('Report: the by-parts steps, no integral');
  assert.deepEqual(errs, [], 'console errors'); ok('0 console errors');
  console.log(`\n${n} passed`);
} finally { await b.close(); }
