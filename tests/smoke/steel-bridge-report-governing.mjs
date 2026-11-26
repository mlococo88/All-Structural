#!/usr/bin/env node
// Steel Bridge: governing line per girder type (SBGL, 2026-11-25; display only), browser smoke, headless Chromium (tests/lib.mjs openPage).
// A made-up bridge: 60 ft simple span, 10 girders at 4 ft, a mountable 8 in sidewalk over G9-G10 (75 psf), RIDOT; two types: Interior on
// G2–G9 (its design line G2), Exterior on G1, G10.
//   1. Report tab: the governing-line report (G9 worked in full, the table of the lines, "(governing line)" in the title), 0 unresolved §
//      links, 0 KaTeX errors; the output tabs still show the design line G2 (not changed by this PR)
//   2. "Work the line chosen above the tab (report of before)": the report of the design line G2, no table, 0 unresolved; the choice kept in
//      sbd2.ui (rpt.full); the project is not changed; both printed (page counts shown); 0 console errors
//   node tests/smoke/steel-bridge-report-governing.mjs [--shots <dir>]
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const shots = (() => { const i = process.argv.indexOf('--shots'); return i > 0 ? process.argv[i + 1] : null; })();
const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(REPO, 'apps/steel-bridge/engine/model.js'), 'utf8'), ctx);
const M = ctx.window.SBDModel, J = v => JSON.parse(JSON.stringify(v));
const P = J(M.defaultProject()); P.project.name = 'Made-up walk bridge'; P.spans = { lengths: [60], continuity: 'simple' }; P.xs = J(M.defaultXs({ spans: P.spans }));
P.xs.nb = 10; P.xs.bays = new Array(9).fill(4); P.xs.ohL = 2; P.xs.ohR = 2; P.xs.sidewalks.R = { w: 6, t: 8, fence: null, fenceX: null }; P.xs.sidewalks.ped = 75;
P.ownerRules = { owner: 'RIDOT', eta: { D: 'no', R: 'yes', I: 'yes', eD: 1, eR: 1.05, eI: 1.05 } };
const seg = { x0: 0, x1: 60, D: 30, tw: 0.5, topB: 12, topT: 0.75, botB: 14, botT: 1.0 };
P.girders = [{ id: 'G1', label: 'Interior', position: 'interior', beff: 54, segments: [{ ...seg }] }, { id: 'G2', label: 'Exterior', position: 'exterior', beff: 51, segments: [{ ...seg, botT: 1.125 }] }];
M.setLines(P, 0, [1, 2, 3, 4, 5, 6, 7, 8]); M.setLines(P, 1, [0, 9]); P.framing.splices = [];
const SEED = { 'sbd2.project.current': JSON.stringify(J(P)), 'sbd2.ui': JSON.stringify({ otab: 'rpt', itab: 'gird', g: 0, rpt: { scope: 'girder' } }) };

const t0 = Date.now();
const { b, p, errs, blocked } = await openPage(path.join(REPO, 'apps/steel-bridge/index.html'), { vw: 1400, vh: 1000, timeout: 120000, ls: SEED });
const saved = () => p.evaluate(() => JSON.parse(localStorage.getItem('sbd2.project.current')).girders[0]);
try {
  await p.waitForSelector('#rp_build', { timeout: 120000 });
  const s0 = JSON.stringify(await saved());   // the type as the page saved it on load
  assert.equal(await p.$eval('#gBar #o_ln', e => e.value), '1', 'the bar above the tab: the design line G2 (unchanged)');
  // 1. the governing-line report
  await p.click('#rp_build');
  await p.waitForSelector('.rp-doc .rp-h1', { timeout: 900000 });
  const rep = async () => { await p.click('[data-rpact="exp"]'); return p.evaluate(() => ({ bad: document.querySelectorAll('.rp-doc .rp-bad').length, kErr: document.querySelectorAll('.rp-doc .katex-error').length, txt: document.querySelector('.rp-doc').textContent })); };   // textContent: the sections off screen are not laid out (content-visibility)
  let r = await rep();
  assert.equal(r.bad, 0, 'unresolved § links (governing line)'); assert.equal(r.kErr, 0);
  assert.match(r.txt, /Type: Interior on line G9 \(governing line\)/); assert.match(r.txt, /Lines of Type: Interior: the governing line worked in full/); assert.match(r.txt, /G9 \(worked\)/);
  if (shots) { await p.setViewportSize({ width: 2000, height: 1200 }); await p.evaluate(() => { const st = document.createElement('style'); st.id = 'shotCss'; st.textContent = '#hdr,#tabBar,#gBar,.rp-bar,.rp-side,#appFoot,#sbDashCol{display:none!important} .rp-doc table td{vertical-align:top}'; document.head.appendChild(st); });
    const el = p.locator('.rp-doc .rp-sub', { hasText: 'Lines of Type: Interior' }).first(); await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(500); await el.screenshot({ path: path.join(shots, 'sb-report-governing.png') });
    await p.evaluate(() => document.getElementById('shotCss').remove()); await p.setViewportSize({ width: 1400, height: 1000 }); }
  const pdf = async () => { await p.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; }); await p.click('[data-rpact="print"]'); await p.waitForFunction(() => window.__printed > 0, null, { timeout: 300000 });
    await p.emulateMedia({ media: 'print' }); const f = await p.pdf({ format: 'Letter', preferCSSPageSize: true }); await p.emulateMedia({ media: 'screen' }); await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    return (f.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length; };
  const pg1 = await pdf();
  // 2. the report of before
  await p.check('#rp_full'); await p.waitForSelector('#rp_build'); await p.click('#rp_build');
  await p.waitForFunction(() => document.querySelector('.rp-doc .rp-h1') && !/governing line\)/.test(document.querySelector('.rp-doc').innerText.slice(0, 400)), null, { timeout: 900000 });
  r = await rep();
  assert.equal(r.bad, 0, 'unresolved § links (report of before)'); assert.ok(!/Lines of Type: Interior/.test(r.txt)); assert.match(r.txt, /Type: Interior on line G2/);
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('sbd2.ui')).rpt.full), true, 'the choice kept in sbd2.ui');
  assert.equal(JSON.stringify(await saved()), s0, 'the project not changed');
  const pg2 = await pdf();
  assert.deepEqual(errs, [], 'console errors');
  console.log(`ok  Report: governing line ${pg1} printed pages, report of before (design line G2) ${pg2}; ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (blocked.size) console.log('    blocked requests:', [...blocked].join(', '));
} catch (e) {
  console.log('FAIL', e.message, '\n console errors:', errs.slice(0, 5)); process.exitCode = 1;
} finally { await b.close(); }
