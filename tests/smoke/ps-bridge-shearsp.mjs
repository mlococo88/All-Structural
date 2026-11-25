#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), SH-SP (2026-11-25, §4): the stirrup spacing check and β of AASHTO LRFD 10th Ed. Eq. 5.7.3.4.2-2 in
// the page. Headless Chromium, file://, the CDN libraries from tests/libs. The made-up NEXT 24F of tests/engine/psbridge-shearsp.test.mjs
// (45 ft, 6 in deck, A_v = 0.40 in², 6 in over 0.25 L at each end, 18 in between).
//   1. the check summary column: FAIL, the Shear chip FAIL with "Stirrup spacing (5.7.2.5, 5.7.2.6): 1.900 (NG — stirrup spacing 18 in >
//      9.47 in at x = …)", the governing line says the spacing; the Shear (strength) check PASS 0.531;
//   2. the Shear tab: the governing-values card has the spacing row with its reason and § to sh.spr; the table marks β of Eq. -2 (†);
//      the worked steps: sh.AvMin, sh.sx, sh.sxe, sh.beta (Eq. 5.7.3.4.2-2), sh.spr (NG); the § of the card opens sh.spr;
//   3. the Report: the summary note with the reason, the Shear section with the spacing step; the keys written are psb2.* only;
//      0 console errors. SHOT=<dir> saves ps-shear-spacing.png (the Shear check worked steps expanded and the check summary).
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.join(REPO, 'apps/ps-bridge/index.html'), SHOT = process.env.SHOT;
const WHY = 'NG — stirrup spacing 18 in > 9.47 in at x = 11.3–18.0 and 27.0–33.7 ft';
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, p, errs } = await openPage(FILE, { vw: 1600, vh: 1100 });
const otab = t => p.evaluate(t => document.querySelector(`#tabBar [data-otab="${t}"]`).click(), t);
const until = async (f, ms, w) => { const t0 = Date.now(); for (;;) { if (await f()) return; if (Date.now() - t0 > ms) throw new Error('timeout: ' + w); await new Promise(r => setTimeout(r, 200)); } };
try {
  await p.waitForSelector('#tabBar [data-otab]');
  await p.evaluate(() => { localStorage.clear(); const P = PSBModel.defaultProject(); P.project.name = 'SH-SP smoke (made-up NEXT 24F)'; P.base.girder = 'NEXT 24F'; P.spans.lengths = [45]; P.base.ts = 6; P.base.harp.n = 0;
    Object.assign(P.base.opt, { stirAv: 0.40, sEnd: 6, sInt: 18, endZoneLen: 0.25, relAs: 4 }); P.xs.nb = 5; P.xs.bays = [8, 8, 8, 8]; P.xs.ohL = 1.5; P.xs.ohR = 1.5; P.xs.skews = [0, 0];
    P.base.rows = [{ n: 10, y: 2, nd: 2, dbnd: 6 }, { n: 10, y: 4, nd: 2, dbnd: 6 }, { n: 2, y: 6, nd: 0, dbnd: 0 }];
    localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); });
  await p.reload(); await p.waitForSelector('#tabBar [data-otab]'); await p.waitForTimeout(400);
  // 1. the check summary column
  await until(() => p.evaluate(() => !!document.querySelector('#sbDashCol [data-sdgrp="shear"]')), 60000, 'the Shear chip');
  await p.evaluate(() => { const x = document.querySelector('#sbDashCol [data-sdx="shear"]'); if (x && x.getAttribute('aria-expanded') !== 'true') x.click(); });
  await p.waitForTimeout(300);
  const d = await p.evaluate(() => { const c = document.querySelector('#sbDashCol [data-sdgrp="shear"]');
    return { verd: document.querySelector('#sbDashCol .sdVerd').textContent, gov: document.querySelector('#sbDashCol .sdGov').textContent, chip: c.className, val: c.querySelector('.sdVal').textContent, items: [...c.querySelectorAll('.sdList li')].map(l => l.textContent) }; });
  assert.match(d.verd, /^FAIL/); assert.match(d.chip, /sd-fail/); assert.equal(d.val, '1.900');
  assert.ok(d.items.includes('Shear: 0.531'), d.items.join(' | ')); assert.ok(d.items.includes(`Stirrup spacing (5.7.2.5, 5.7.2.6): 1.900 (${WHY})`), d.items.join(' | '));
  assert.match(d.gov, /Stirrup spacing \(5\.7\.2\.5, 5\.7\.2\.6\): 1\.900 \(NG — stirrup spacing 18 in > 9\.47 in/);
  ok(`check summary: ${d.verd.trim()}; Shear chip ${d.val} FAIL; ${d.items.join(' | ')}`);
  // 2. the Shear tab
  await otab('shear'); await until(() => p.evaluate(() => !!document.querySelector('#card-shgov') && !!document.getElementById('st-sh.spr')), 60000, 'the Shear tab');
  const s = await p.evaluate(() => ({ card: document.querySelector('#card-shgov').textContent, links: [...document.querySelectorAll('#card-shgov a.wk')].map(a => a.getAttribute('href')),
    dag: document.querySelectorAll('#card-shtab sup').length, steps: ['sh.xg', 'sh.AvMin', 'sh.sx', 'sh.sxe', 'sh.beta', 'sh.stReq', 'sh.spr'].map(id => !!document.getElementById('st-' + id)),
    beta: document.getElementById('st-sh.beta').textContent, spr: document.getElementById('st-sh.spr').textContent }));
  assert.ok(s.card.includes(`FAIL: ${WHY}`), s.card); assert.match(s.card, /0\.531 at x = 13\.50 ft PASS/); assert.ok(s.links.includes('#st-sh.spr'));
  assert.ok(s.dag >= 7, '† on the Eq. -2 stations ' + s.dag); assert.deepEqual(s.steps, s.steps.map(() => true), 'steps ' + s.steps);
  assert.match(s.beta, /5\.7\.3\.4\.2-2/); assert.match(s.spr, /NG — stirrup spacing 18 in > 9\.47 in/);
  ok(`Shear tab: the spacing row with its reason and §; β of Eq. -2 marked at ${s.dag} stations; steps ${['sh.xg', 'sh.AvMin', 'sh.sx', 'sh.sxe', 'sh.beta', 'sh.stReq', 'sh.spr'].join(', ')}`);
  await p.evaluate(() => document.querySelector('#card-shgov a.wk[href="#st-sh.spr"]').click()); await p.waitForTimeout(400);
  assert.ok(await p.evaluate(() => { const e = document.getElementById('st-sh.spr'); return !!e && e.getBoundingClientRect().height > 0; }), 'the § opens sh.spr');
  ok('the § of the spacing row opens its worked step');
  if (SHOT) {
    await p.evaluate(() => { document.querySelectorAll('details.sg-t').forEach(t => { if (t.dataset.sgk === 'crit' || t.dataset.sgk === 'sp') t.open = true; }); document.getElementById('st-sh.AvMin').scrollIntoView({ block: 'start' }); });
    await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(SHOT, 'ps-shear-spacing.png') });
    await p.evaluate(() => document.getElementById('st-sh.spr').scrollIntoView({ block: 'center' })); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(SHOT, 'ps-shear-spacing-2.png') });
    const c = await p.$('#card-shgov'); await c.scrollIntoViewIfNeeded(); await c.screenshot({ path: path.join(SHOT, 'ps-shear-spacing-card.png') });
  }
  // 3. the Report
  await otab('rpt'); await until(() => p.evaluate(() => /Stirrup spacing check where it governs/.test((document.querySelector('#rptHost') || {}).textContent || '')), 180000, 'the Report');
  const r = await p.evaluate(w => { const t = document.querySelector('#rptHost').textContent; return { note: t.includes('Stirrup spacing (5.7.2.5, 5.7.2.6): ' + w), spr: /Stirrup spacing check where it governs/.test(t), eq2: /5\.7\.3\.4\.2-2/.test(t) }; }, WHY);
  assert.ok(r.eq2, 'Eq. 5.7.3.4.2-2 in the Report');
  assert.ok(r.note, 'the Report summary note'); assert.ok(r.spr, 'the spacing step in the Report');
  ok('Report: the summary says why (the spacing), the Shear section has the spacing step');
  const keys = await p.evaluate(() => Object.keys(localStorage)); assert.ok(keys.every(k => k.startsWith('psb2.')), keys.join(', '));
  assert.deepEqual(errs, [], 'console errors ' + errs.join(' | '));
  ok(`keys written: ${keys.join(', ')}; 0 console errors`);
} finally { await b.close(); }
console.log(`\n${n} checks passed`);
