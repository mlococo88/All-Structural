#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html) batch G8 (2026-11-15), headless Chromium, file:// (three.js r128 from tests/libs): the 3D view's
//   reinforcement cage layers (the old app's 3D cage): Stirrups, Longitudinal bars, Splitting steel, Cambered shape, Strand stress colour —
//   off at first; switched on, each group has its objects (counts = geom's), the stress colour hides the plain straight strands, the notes
//   name the camber and the f_ps of the colours; the choice kept in psb2.ui; "Capture for the Report" puts the view in the Report §2 as a
//   figure "3D view (captured …)". 0 console errors.
//   node tests/smoke/ps-bridge-3dcage.mjs [--shots <dir>]
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const shots = (i => i > 0 ? process.argv[i + 1] : null)(process.argv.indexOf('--shots'));
let n = 0; const ok = m => { n++; console.log('  ok  ', m); }; const t0 = Date.now();
const { b, p, errs } = await openPage(path.join(REPO, 'apps/ps-bridge/index.html'), { vw: 1400, vh: 1000 });
const KEYS = ['stir', 'lon', 'spl', 'cam', 'sfc'];
try {
  await p.waitForFunction(() => window.PSB3DUI && document.getElementById('out').innerText.length > 50, null, { timeout: 120000 });
  await p.click('#tabBar [data-otab="3d"]'); await p.waitForFunction(() => window.PSB3DUI.state().counts, null, { timeout: 60000 });
  const off = await p.evaluate(K => K.map(k => document.querySelector(`[data-v3d="${k}"]`).checked), KEYS); assert.deepEqual(off, [false, false, false, false, false]); ok('the five cage layers are off at first');
  for (const k of KEYS) { await p.check(`[data-v3d="${k}"]`); await p.waitForTimeout(100); }
  const st = await p.evaluate(() => { const s = window.PSB3DUI.state(), G = window.PSB3DUI.geom(PSBModel.load(localStorage).project); return { c: s.counts, cam: s.camNote, sfc: s.sfcNote, g: { stir: G.cage.filter(q => q.kind === 'stir').length, lon: G.cage.filter(q => q.kind === 'lon').length, spl: G.cage.filter(q => q.kind === 'spl').length } }; });
  assert.deepEqual([st.c.stir, st.c.lon, st.c.spl], [st.g.stir, st.g.lon, st.g.spl]); assert.ok(st.c.stir > 50 && st.c.cam >= 1 && st.c.sfc >= 1, JSON.stringify(st.c));
  assert.match(await p.textContent('#v3d-cage'), /Cambered shape: the final camber Δ_final = -?[\d.]+ in .* × 12/); assert.match(await p.textContent('#v3d-cage'), /Strand stress colour: f_ps\(x\) \/ f_ps/);
  ok(`switched on: ${st.c.stir} stirrups, ${st.c.lon} top bars, ${st.c.spl} splitting legs (= geom), the cambered shape and the stress colour; notes shown`);
  if (shots) await p.locator('#v3d-host').screenshot({ path: path.join(shots, 'G8-3d-cage.png') });
  const lay = await p.evaluate(() => JSON.parse(localStorage.getItem('psb2.ui')).v3d.lay); assert.ok(KEYS.every(k => lay[k] === true)); ok('the layers kept in psb2.ui');
  await p.click('#v3d_mode'); await p.selectOption('#v3d_mode', 'g2'); await p.waitForTimeout(600);
  if (shots) await p.locator('#v3d-host').screenshot({ path: path.join(shots, 'G8-3d-cage-closeup.png') });
  await p.click('#v3d_cap'); await p.waitForTimeout(300); assert.match(await p.textContent('#v3d-cap'), /Captured for the Report/); ok('Capture for the Report');
  await p.click('#tabBar [data-otab="rpt"]'); await p.waitForFunction(() => /3D view \(captured on the 3D view tab/.test(document.getElementById('out').textContent), null, { timeout: 60000 });
  const im = await p.evaluate(() => { const i = [...document.querySelectorAll('#out figure img')].find(x => /^data:image\/png/.test(x.src)); return i ? { w: i.naturalWidth, h: i.naturalHeight } : null; });
  assert.ok(im && im.w > 100 && im.h > 100, JSON.stringify(im)); ok(`the Report §2 shows the captured view (${im.w} × ${im.h} px)`);
  if (shots) await p.locator('#out figure:has(img)').first().screenshot({ path: path.join(shots, 'G8-report-3d.png') });
  for (const k of KEYS) await p.evaluate(k => { const u = JSON.parse(localStorage.getItem('psb2.ui')); u.v3d.lay[k] = false; u.v3d.mode = 'bridge'; localStorage.setItem('psb2.ui', JSON.stringify(u)); }, k);
  assert.deepEqual(errs, []); ok('0 console errors');
  console.log(`ps-bridge-3dcage: ${n} checks passed (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
} finally { await b.close(); }
