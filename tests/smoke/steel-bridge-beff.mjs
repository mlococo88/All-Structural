#!/usr/bin/env node
// Browser smoke test of the calculated b_eff with an optional override (BEFF, 2026-11-25; engineer's choice "Calculated, optional
// override"; AASHTO LRFD 10th Ed. Art. 4.6.2.6.1). apps/steel-bridge/index.html, headless Chromium (tests/lib.mjs openPage), seeded with
// a project of two types on N_b = 5, bays 9.5 ft, overhangs 3.25 / 4.00 ft: Interior saved before 2026-11-25 (no beffOv) with b_eff 120 in
// (tributary 114 in), Exterior saved with beffOv false (G1 96 in, G5 105 in):
//   1. the load notice lists Interior as keeping its entered b_eff (calculated G2, G3, G4 114.0 in); the saved project has beffOv true
//      for Interior and still beff 120;
//   2. Girders & plates, Exterior: "Override b_eff" off, the value box disabled, the worked b_eff of G1 (96.00) and G5 (105.00);
//      the screenshot sb-beff.png of the Selected type card (optional shot dir);
//   3. ticking the override saves beffOv true and the worked lines read the entered value; unticking returns to the widths;
//   4. Cross-section tab: the tributary width of G5 links to its worked b_eff (Girders & plates tab, #beff-G5);
//   5. Section properties: b_eff (G1) 96.00 in with its link; 0 console errors.
//   node tests/smoke/steel-bridge-beff.mjs [shotDir]
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const shotDir = process.argv[2] || '';
const FILE = path.join(REPO, 'apps/steel-bridge/index.html');
const saved = p => p.evaluate(() => JSON.parse(localStorage.getItem('sbd2.project.current') || '{}'));

// the seed: built the way the app builds a new project (engine/model.js newProject), written as the saved file text
const vm = await import('vm'), ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(REPO, 'apps/steel-bridge/engine/model.js'), 'utf8'), ctx);
const P0 = ctx.SBDModel.newProject(); P0.xs.ohR = 4.0; delete P0.girders[0].beffOv; P0.girders[0].beff = 120; P0.project.name = 'BEFF smoke';
const A = await openPage(FILE, { vw: 1440, vh: 1000, ls: { 'sbd2.project.current': ctx.SBDModel.exportJSON(P0) } });
try {
  const p = A.p;
  await p.waitForSelector('#tabBar [data-otab="loads"]');
  // 1. the one-time notice
  const toast = await p.evaluate(() => (document.getElementById('toast') || {}).innerText || '');
  assert.match(toast, /b_eff is now calculated/); assert.match(toast, /Interior 120\.0 in \(calculated: G2 114\.0, G3 114\.0, G4 114\.0 in\)/); assert.doesNotMatch(toast, /Exterior/);
  await p.click('#inTabs [data-itab="gird"]'); await p.waitForTimeout(300);
  let S = await saved(p); assert.equal(S.girders[0].beffOv, true); assert.equal(S.girders[0].beff, 120);
  // 2. Exterior: calculated per line
  await p.click('#inPanes [data-gsel="1"]'); await p.waitForTimeout(300);
  assert.equal(await p.isChecked('#i_beffOv'), false); assert.equal(await p.isDisabled('#inPanes [data-path="girders.1.beff"]'), true);
  const g1 = await p.innerText('#beff-G1'), g5 = await p.innerText('#beff-G5');
  assert.match(g1, /96\.00/); assert.match(g5, /105\.00/); assert.match(g5, /4\.6\.2\.6\.1/);
  if (shotDir) { const card = (await p.$$('#inPanes [data-pane="gird"] section.sec'))[1]; await card.scrollIntoViewIfNeeded(); await card.screenshot({ path: path.join(shotDir, 'sb-beff.png') }); }
  // 3. the override
  await p.check('#i_beffOv'); await p.waitForTimeout(300);
  S = await saved(p); assert.equal(S.girders[1].beffOv, true); assert.equal(S.girders[1].beff, 96);
  assert.match(await p.innerText('#beff-G5'), /entered/); assert.match(await p.innerText('#beff-G5'), /96\.00/);
  if (shotDir) { const card = (await p.$$('#inPanes [data-pane="gird"] section.sec'))[1]; await card.screenshot({ path: path.join(shotDir, 'sb-beff-override.png') }); }
  await p.uncheck('#i_beffOv'); await p.waitForTimeout(300); S = await saved(p); assert.equal(S.girders[1].beffOv, false); assert.match(await p.innerText('#beff-G5'), /105\.00/);
  // 4. Cross-section tab link
  await p.click('#inTabs [data-itab="xsec"]'); await p.waitForTimeout(300);
  await p.click('#inPanes [data-beffgo="1:4"]'); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => !document.querySelector('#inPanes [data-pane="gird"]').hidden), true); assert.ok(await p.$('#beff-G5'));
  // 5. Section properties
  await p.click('#tabBar [data-otab="sec"]'); await p.waitForSelector('#out [data-beffgo]', { timeout: 120000 });
  const t = await p.innerText('#out'); assert.match(t, /beff \(G1\)\s*96\.00 in/);
  assert.deepEqual(A.errs, [], 'console errors');
  console.log('steel-bridge-beff: all checks pass');
} finally { await A.b.close(); }
