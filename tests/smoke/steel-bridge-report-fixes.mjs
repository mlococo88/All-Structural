#!/usr/bin/env node
// Steel Bridge Report fixes (SBRF, 2026-11-25; display only), browser smoke, headless Chromium (tests/lib.mjs openPage):
//   a made-up bridge (60 ft simple span, 10 girders at 4 ft, a mountable 8 in sidewalk, two girder types: Interior on G2–G9 with b_eff
//   54 in, its design line G6; Exterior on G1, G10), the Report tab of Interior:
//   1. the girder-type bar (#gBar) is on the screen and not printed (print emulation), the report alone is printed;
//   2. the report: 0 console errors, 0 KaTeX errors, 0 unresolved § links; "Type: Interior on line G6" in the title, the b_eff note, the
//      stiffener rows named "Type: Interior, …", the moment reversal substitution in brackets, the Z_r of later zones referring to the first;
//   3. page.pdf() prints it (page count shown).
//   node tests/smoke/steel-bridge-report-fixes.mjs
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(REPO, 'apps/steel-bridge/engine/model.js'), 'utf8'), ctx);
const M = ctx.window.SBDModel, J = v => JSON.parse(JSON.stringify(v));
const P = J(M.defaultProject()); P.project.name = 'Made-up walk bridge'; P.spans = { lengths: [60], continuity: 'simple' }; P.xs = J(M.defaultXs({ spans: P.spans }));
P.xs.nb = 10; P.xs.bays = new Array(9).fill(4); P.xs.ohL = 2; P.xs.ohR = 2; P.xs.sidewalks.L = { w: 6, t: 8, fence: null, fenceX: null }; P.xs.sidewalks.ped = 75;
P.ownerRules = { owner: 'RIDOT', eta: { D: 'no', R: 'yes', I: 'yes', eD: 1, eR: 1.05, eI: 1.05 } };
const seg = { x0: 0, x1: 60, D: 30, tw: 0.5, topB: 12, topT: 0.75, botB: 14, botT: 1.0 };
P.girders = [{ id: 'G1', label: 'Interior', position: 'interior', beff: 54, segments: [{ ...seg }] }, { id: 'G2', label: 'Exterior', position: 'exterior', beff: 51, segments: [{ ...seg, botT: 1.125 }] }];
M.setLines(P, 0, [1, 2, 3, 4, 5, 6, 7, 8]); M.setLines(P, 1, [0, 9]); P.girders[0].line = 5; P.framing.splices = [];

const t0 = Date.now();
const { b, p, errs, blocked } = await openPage(path.join(REPO, 'apps/steel-bridge/index.html'), { vw: 1400, vh: 1000, timeout: 120000,
  ls: { 'sbd2.project.current': JSON.stringify(J(P)), 'sbd2.ui': JSON.stringify({ otab: 'rpt', g: 0, rpt: { scope: 'girder' } }) } });
try {
  await p.waitForSelector('#rp_build', { timeout: 120000 });
  const bar = await p.evaluate(() => { const g = document.getElementById('gBar'); return g && !g.hidden && getComputedStyle(g).display !== 'none' ? g.innerText.replace(/\s+/g, ' ') : ''; });
  assert.match(bar, /G6 \(design line\)/, `the girder-type bar on the screen: ${bar}`);
  await p.click('#rp_build');
  await p.waitForSelector('.rp-doc .rp-h1', { timeout: 300000 });
  const s = await p.evaluate(() => ({ kErr: document.querySelectorAll('.rp-doc .katex-error').length, bad: document.querySelectorAll('.rp-doc .rp-bad').length, text: document.querySelector('.rp-doc').innerText }));
  assert.equal(s.kErr, 0, 'KaTeX errors'); assert.equal(s.bad, 0, 'unresolved § links');
  assert.ok(!/NaN|undefined|\[object/.test(s.text), 'NaN / undefined in the report text');
  assert.match(s.text, /Type: Interior on line G6/);
  assert.match(s.text, /the tributary width of line G6 is 48\.00 in/);
  assert.match(s.text, /Type: Interior, (stiffener|connection plate) at/);
  assert.ok(!/\d\.\d\d\d?\.\d\d/.test(s.text.replace(/\d{1,3}(,\d{3})+/g, '0')), 'no two decimal points in one number');
  assert.match(s.text, /The same as the first zone with this limit state: see §\d+\.\d+/);
  // print: the report alone, the girder-type bar hidden
  await p.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await p.click('[data-rpact="print"]'); await p.waitForFunction(() => window.__printed > 0, null, { timeout: 300000 });
  await p.emulateMedia({ media: 'print' });
  const pr = await p.evaluate(() => { const vis = el => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
    return { gBar: vis(document.getElementById('gBar')), box: vis(document.getElementById('rp-print')), kErr: document.querySelectorAll('#rp-print .katex-error').length }; });
  assert.deepEqual(pr, { gBar: false, box: true, kErr: 0 }, JSON.stringify(pr));
  const pdf = await p.pdf({ format: 'Letter', preferCSSPageSize: true }), pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  assert.ok(pages > 20, `${pages} printed pages`);
  await p.emulateMedia({ media: 'screen' }); await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  assert.deepEqual(errs, [], 'console errors');
  console.log(`ok  Report fixes: girder-type bar on screen, not printed; ${pages} printed pages; ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (blocked.size) console.log('    blocked requests:', [...blocked].join(', '));
} catch (e) {
  console.log('FAIL', e.message, '\n console errors:', errs.slice(0, 5)); process.exitCode = 1;
} finally { await b.close(); }
