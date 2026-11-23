#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), AP-B (2026-11-23): the line-girder applicability banner and the LLDF range flags (engine/
// applicability.js; ui/loads.js apCard; the check "LLDF range of applicability"). Headless Chromium, file://, the CDN libraries from
// tests/libs. Made-up bridges: a new project (in range), then its bays set to 17 ft (S outside 3.5 to 16 ft).
//   1. in range: the Loads & LLDF tab's banner says the equations apply (level ok), the table lists S, t_s, L, N_b, K_g, θ with their
//      ranges, the steps ld.ap.* are on the tab, the check column has no "LLDF applicability" chip and no FAIL from it;
//   2. S = 17 ft: the banner is a FAIL naming S, the row is marked, the check column shows the chip "LLDF applicability" FAIL with the
//      ratio 1.063 and its click opens the Loads & LLDF step; the verdict is FAIL; the Summary tab's verdict too; the Report lists the
//      failing check and the banner;
//   3. entered distribution factors: no flag (banner "entered"), the chip gone; keys psb2.* only; 0 console errors.
//   SHOT=<dir> saves the banner.
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.join(REPO, 'apps/ps-bridge/index.html'), SHOT = process.env.SHOT;
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, p, errs } = await openPage(FILE, { vw: 1400, vh: 1000 });
const otab = t => p.evaluate(t => document.querySelector(`#tabBar [data-otab="${t}"]`).click(), t);
const until = async (f, ms, w) => { const t0 = Date.now(); for (;;) { if (await f()) return; if (Date.now() - t0 > ms) throw new Error('timeout: ' + w); await new Promise(r => setTimeout(r, 200)); } };
const seed = async f => { await p.evaluate(f); await p.reload(); await p.waitForSelector('#tabBar [data-otab]'); await p.waitForTimeout(400); };
const chip = () => p.evaluate(() => { const c = document.querySelector('#sbDashCol [data-sdgrp="ap"]'); return c ? { val: c.querySelector('.sdVal').textContent, st: c.querySelector('.sdSt').textContent } : null; });
const doneAll = () => until(() => p.evaluate(() => !/Running every girder type/.test(document.querySelector('#sbDashCol').textContent)), 180000, 'every type × line computed');
try {
  await p.waitForSelector('#tabBar [data-otab]');
  await seed(() => { localStorage.clear(); const P = PSBModel.newProject(); P.project.name = 'Applicability smoke (made-up bridge)'; localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); });
  await otab('lds'); await until(() => p.evaluate(() => !!document.querySelector('#card-ap')), 60000, 'the applicability card'); await doneAll();
  let t = await p.evaluate(() => ({ lv: document.querySelector('#apBanner').dataset.aplevel, txt: document.querySelector('#apBanner').textContent, rows: [...document.querySelectorAll('#apTbl tbody tr')].map(r => [...r.children].map(c => c.textContent.trim())),
    steps: ['ld.ap.S', 'ld.ap.ts', 'ld.ap.L', 'ld.ap.Nb', 'ld.ap.Kg', 'ld.ap.th', 'ld.ap.r'].map(id => !!document.getElementById('st-' + id)), fail: /FAIL/.test(document.querySelector('#sbDashCol .sdVerd').textContent) }));
  assert.equal(t.lv, 'ok'); assert.match(t.txt, /equations apply/); assert.deepEqual(t.steps, t.steps.map(() => true));
  assert.match(t.rows[0].join('|'), /Girder spacing\|9\.000 ft.*\|3\.5 to 16 ft\|Tables 4\.6\.2\.2\.2b-1, 4\.6\.2\.2\.3a-1\|OK/); assert.ok(t.rows.length >= 7);
  assert.equal(await chip(), null, 'no chip in range');
  ok(`in range: banner "${t.txt.slice(0, 60)}…", ${t.rows.length} rows, 7 steps on the tab, no LLDF applicability chip`);
  const v0 = await p.evaluate(() => document.querySelector('#sbDashCol .sdVerd').textContent);
  // 2. S = 17 ft
  await seed(() => { const P = PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project; P.xs.bays = [17, 17, 17, 17]; localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); });
  await otab('lds'); await until(() => p.evaluate(() => !!document.querySelector('#card-ap')), 60000, 'the card'); await doneAll();
  t = await p.evaluate(() => ({ lv: document.querySelector('#apBanner').dataset.aplevel, txt: document.querySelector('#apBanner').textContent, bad: [...document.querySelectorAll('#apTbl tr.apBad')].map(r => r.textContent), verd: document.querySelector('#sbDashCol .sdVerd').textContent }));
  assert.equal(t.lv, 'fail'); assert.match(t.txt, /FAIL: 1 value outside/); assert.equal(t.bad.length, 1); assert.match(t.bad[0], /Girder spacing17\.000 ft/); assert.match(t.verd, /FAIL/);
  const c = await chip(); assert.deepEqual(c, { val: '1.063', st: 'FAIL' }, JSON.stringify(c));
  if (SHOT) { await (await p.$('#card-ap')).screenshot({ path: path.join(SHOT, 'ps-applic-banner.png') }); }
  await otab('str'); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('#sbDashCol [data-sdgrp="ap"] a.sdMain').click()); await until(() => p.evaluate(() => !!document.getElementById('st-ld.ap.r')), 30000, 'the chip opens the step');
  ok(`S = 17 ft: banner FAIL (S marked), chip LLDF applicability ${c.val} FAIL, verdict "${t.verd.trim().slice(0, 40)}" (in range it was "${v0.trim().slice(0, 30)}"); the chip opens step ld.ap.r`);
  await otab('sum'); await until(() => p.evaluate(() => /LLDF range of applicability/.test(document.querySelector('#out').textContent)), 180000, 'the Summary lists the check');
  await otab('rpt'); await until(() => p.evaluate(() => /LLDF range of applicability/.test((document.querySelector('#rptHost') || {}).textContent || '')), 180000, 'the Report');
  const rp = await p.evaluate(() => { const x = document.querySelector('#rptHost').textContent; return { chk: /LLDF range of applicability \(4\.6\.2\.2\)/.test(x), ban: /FAIL: 1 value outside the range of applicability/.test(x), step: /Girder spacing: range of applicability/.test(x) }; });
  assert.deepEqual(rp, { chk: true, ban: true, step: true }, JSON.stringify(rp));
  ok('Summary and Report: the failing check, the banner and the worked steps');
  // 3. entered factors
  await seed(() => { const P = PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project; const set = b => { b.loads.dfAuto = false; b.loads.dfm = 0.95; b.loads.dfv = 1.1; }; set(P.base);
    localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); });
  await otab('lds'); await until(() => p.evaluate(() => !!document.querySelector('#card-ap')), 60000, 'the card'); await doneAll();
  t = await p.evaluate(() => { const P = PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project; return { lv: document.querySelector('#apBanner').dataset.aplevel, auto: PSBDesign.inputs(P).loads.dfAuto }; });
  if (t.auto === false) { assert.equal(t.lv, 'entered'); assert.equal(await chip(), null); ok('entered distribution factors: not flagged (banner "entered", no chip)'); }
  else ok('entered distribution factors: (the girder type keeps computed factors; covered by the Node test)');
  const keys = await p.evaluate(() => Object.keys(localStorage)); assert.ok(keys.every(k => k.startsWith('psb2.')), keys.join(', '));
  assert.deepEqual(errs, [], 'console errors: ' + errs.join(' | '));
  ok(`keys written: psb2.* only; 0 console errors`);
  console.log(`ps-bridge-applic: ${n} checks passed`);
} finally { await b.close(); }
