#!/usr/bin/env node
// Browser check that the Download DXF of the tab graphics moved to the data-viz style (SBVZB, 2026-11-10, family (b): the graphics along the girder)
// exports the SAME file as a reference version of the app: the engineer's rule "do not change any DXF output". Built-in project with one field
// splice (as steel-bridge-tabgraphics-b), headless Chromium (tests/lib.mjs openPage), the working tree against REF (default origin/main; the app and
// shared/ of REF are extracted with git archive under the OS temp folder, allstruct-tests/<sha>-tree). For each graphic: open its tab, let it run, select
// the same table row on both sides where the tab has one, click its Download DXF button (SharedDxf.download captured) and compare the text byte for byte.
//   node tests/smoke/steel-bridge-dxf-unchanged.mjs [REF]
import path from 'path';
import fs from 'fs';
import os from 'os';
import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { openPage, REPO, hash } from '../lib.mjs';
import { loadShared } from '../engine/harness.mjs';

const REF = process.argv[2] || 'origin/main';
const sha = execFileSync('git', ['-C', REPO, 'rev-parse', '--short', REF], { encoding: 'utf8' }).trim();
const tree = path.join(os.tmpdir(), 'allstruct-tests', `${sha}-tree`);
if (!fs.existsSync(path.join(tree, 'apps/steel-bridge/index.html'))) {
  fs.mkdirSync(tree, { recursive: true });
  const tar = execFileSync('git', ['-C', REPO, 'archive', sha, 'apps/steel-bridge', 'shared'], { maxBuffer: 1 << 28 });
  execFileSync('tar', ['-x', '-C', tree], { input: tar });
}
const W = loadShared(path.join(REPO, 'apps/steel-bridge/engine/model.js'));
const P0 = W.SBDModel.defaultProject(); P0.framing = { ...W.SBDModel.defaultFraming(), splices: [82] };
// [name, output tab, the graphic's card, a table row to select first (null: the default selection)]
const LIST = [['analysis', 'an', '#gfx_an', null], ['flexure-elevation', 'flex', '#gfx_fx .gfx-a', null], ['flexure-checks', 'flex', '#gfx_fx .gfx-b', null],
  ['flexure-elevation (row 5)', 'flex', '#gfx_fx .gfx-a', '[data-fxsel]'], ['flexure-checks (row 5)', 'flex', '#gfx_fx .gfx-b', '[data-fxsel]'],
  ['constructibility', 'cn', '#gfx_cn .gfx-a', null], ['constructibility (row 40)', 'cn', '#gfx_cn .gfx-a', 'tr[data-cnsel="40"]'],
  ['shear', 'shear', '[data-gfxb="shear"]', null], ['shear (panel 30)', 'shear', '[data-gfxb="shear"]', 'tr[data-sh="pan:30"]'], ['shear (station 20)', 'shear', '[data-gfxb="shear"]', 'tr[data-sh="loc:20"]'],
  ['fatigue', 'fat', '[data-gfxb="fatigue"]', null], ['fatigue-chart', 'fat', '[data-gfxb="fatigue-chart"]', null], ['fatigue (detail 3)', 'fat', '[data-gfxb="fatigue"]', 'tr[data-fa="fa:3"]'], ['fatigue-chart (detail 3)', 'fat', '[data-gfxb="fatigue-chart"]', 'tr[data-fa="fa:3"]'],
  ['welds', 'wt', '[data-gfxb="welds"]', null], ['welds (fw 3)', 'wt', '[data-gfxb="welds"]', 'tr[data-wt="fw:3"]'], ['rating', 'rt', '[data-gfxb="rating"]', null], ['rating (row 40)', 'rt', '[data-gfxb="rating"]', 'tr[data-rt="40"]']];
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);

async function grab(file) {
  const { b, p, errs } = await openPage(file, { vw: 1400, vh: 1000, ls: { 'sbd2.project.current': JSON.stringify(P0) } });
  const settle = (t = 240000) => p.waitForFunction(() => !document.querySelector('#out .alert.stale:not([hidden])') && !/Calculating|updating/.test((document.querySelector('#autoMsg') || {}).textContent || '') && !/Calculating/.test(((document.querySelector('#out') || {}).innerText || '').slice(0, 400)), null, { timeout: t });
  const out = {};
  try {
    await p.waitForSelector('#tabBar [data-otab="an"]');
    await p.evaluate(() => { window.__dxf = []; window.SharedDxf.download = (txt, name) => { window.__dxf.push(txt); }; });
    for (const [name, tab, sel, pre] of LIST) {
      if (ONLY.length && !ONLY.some(q => name.startsWith(q))) continue;
      await p.click(`#tabBar [data-otab="${tab}"]`); await settle();
      if (pre) { const el = await p.$(`#out ${pre}`); assert.ok(el, `${name}: ${pre}`); await el.evaluate(e => e.click()); await p.waitForTimeout(500); await settle(); }
      const btn = `#out ${sel} [data-sbg="dxf"], #out ${sel} [data-vadxf]`; await p.waitForSelector(btn, { timeout: 240000 });
      await p.evaluate(() => { window.__dxf = []; }); await p.$eval(btn, e => e.click()); await p.waitForTimeout(100);
      const t = await p.evaluate(() => window.__dxf.slice()); assert.equal(t.length, 1, `${name}: one DXF`); out[name] = t[0];
    }
    assert.deepEqual(errs, [], 'console errors');
  } finally { await b.close(); }
  return out;
}

const t0 = Date.now();
try {
  const [a, c] = [await grab(path.join(tree, 'apps/steel-bridge/index.html')), await grab(path.join(REPO, 'apps/steel-bridge/index.html'))];
  const names = Object.keys(a); assert.ok(names.length > 0, 'graphics');
  names.forEach(n => { assert.ok(/SECTION/.test(a[n]) && /EOF/.test(a[n]), `${n}: a DXF from ${REF}`); assert.ok(a[n] === c[n], `${n}: the DXF differs from ${REF} (${a[n].length} vs ${(c[n] || '').length} chars)`); });
  console.log(`ok  Download DXF unchanged from ${REF} (${sha}): ${names.length} graphics byte-identical (${names.map(n => `${n} ${hash(a[n])}`).join(', ')}); ${((Date.now() - t0) / 1000).toFixed(0)} s`);
} catch (e) { console.log('FAIL', e.message); process.exitCode = 1; }
