#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), PL-A (2026-11-23): the pedestrian live load (AASHTO LRFD 10th Ed. 3.6.1.6) and a utility line load
// in the page. Headless Chromium, file://, the CDN libraries from tests/libs. A made-up bridge: a new project (5 girders at 9 ft, one 120 ft
// span) with a 6 ft left sidewalk.
//   1. Cross-section tab: with the sidewalk and no pedestrian load the card says none is applied; 75 psf entered in the box (a real change
//      event) is saved (xs.dl.ped), the card states the load and the per-line table gets its PL row;
//   2. Loads & LLDF tab: the card "Pedestrian live load" with the engine's values (R.pl), the distribution table's PL row, the worked steps
//      ld.pl.* and dl.G<g>.PL on the tab; a § of the card opens its step;
//   3. Stresses / Flexure / Shear tabs: the note with the § to the Loads & LLDF step; the midspan M_LL of the Stresses step includes M_PL;
//   4. the Report: its loads section has the pedestrian card and the steps; a utility row (UT) adds to the line's DW; the keys written are
//      psb2.* only; 0 console errors. SHOT=<dir> saves the input card and the Loads & LLDF card.
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.join(REPO, 'apps/ps-bridge/index.html'), SHOT = process.env.SHOT;
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, p, errs } = await openPage(FILE, { vw: 1400, vh: 1000 });
const otab = t => p.evaluate(t => document.querySelector(`#tabBar [data-otab="${t}"]`).click(), t);
const itab = t => p.evaluate(t => document.querySelector(`#inTabs [data-itab="${t}"]`).click(), t);
const until = async (f, ms, w) => { const t0 = Date.now(); for (;;) { if (await f()) return; if (Date.now() - t0 > ms) throw new Error('timeout: ' + w); await new Promise(r => setTimeout(r, 200)); } };
const shot = async (sel, name) => { if (!SHOT) return; const el = await p.$(sel); if (el) await el.screenshot({ path: path.join(SHOT, name) }); };
try {
  await p.waitForSelector('#tabBar [data-otab]');
  await p.evaluate(() => { localStorage.clear(); const P = PSBModel.newProject(); P.project.name = 'Pedestrian load smoke (made-up bridge)'; P.xs.dl.swL = { w: 6, t: 9 };
    localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); });
  await p.reload(); await p.waitForSelector('#tabBar [data-otab]'); await p.waitForTimeout(400);
  // 1. the Cross-section tab
  await itab('xsec'); await p.waitForSelector('#card-dl');
  assert.ok(await p.$('#plOff'), 'the "no pedestrian load" note'); assert.equal(await p.$('#plRow'), null);
  const before = await p.evaluate(() => { const P = PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, i = PSBDesign.inputs(P), R = PSBHoldDown.compute(JSON.parse(JSON.stringify(i))); const m = R.grid.reduce((a, r) => Math.abs(r.x - R.L / 2) < Math.abs(a.x - R.L / 2) ? r : a); return { pl: i.pl || null, Mll: m.Mll, Mu: R.MuMid, s3: m.s3Bot }; });
  assert.equal(before.pl, null);
  // SET (2026-11-26): the pedestrian live load moved to the Settings window (Superimposed dead load); its copy edits the same input
  await p.click('#psGear'); await p.click('[data-pssg="sdl"]'); const ped = '#psSet [data-path="xs.dl.ped"]';
  await p.fill(ped, '75'); await p.dispatchEvent(ped, 'change'); await p.waitForTimeout(500); await p.click('#psSetSave');
  await itab('xsec'); await p.waitForSelector('#plOn');
  const c = await p.evaluate(() => ({ ped: JSON.parse(localStorage.getItem('psb2.project.current')).xs.dl.ped, note: document.querySelector('#plOn').textContent, row: [...document.querySelectorAll('#plRow td')].map(t => t.textContent) }));
  assert.equal(c.ped, 75); assert.match(c.note, /4\.50 ft walkable × 0\.075 ksf = 0\.3375 klf/); assert.deepEqual(c.row.slice(1), ['0.0675', '0.0675', '0.0675', '0.0675', '0.0675']);
  ok(`Cross-section tab: 75 psf saved (xs.dl.ped); ${c.note.slice(0, 96)}…; PL row ${c.row.slice(1).join(' ')}`);
  await shot('#card-dl', 'ps-pl-inputs.png');
  // 2. Loads & LLDF
  await otab('lds'); await until(() => p.evaluate(() => !!document.querySelector('#card-pl')), 60000, 'the pedestrian card');
  const L = await p.evaluate(() => { const P = PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, i = PSBDesign.inputs(P), R = PSBHoldDown.compute(JSON.parse(JSON.stringify(i)));
    const m = R.grid.reduce((a, r) => Math.abs(r.x - R.L / 2) < Math.abs(a.x - R.L / 2) ? r : a);
    return { pl: R.pl, card: document.querySelector('#card-pl').textContent, steps: ['ld.pl.w', 'ld.pl.M', 'ld.pl.V', 'ld.pl.MLLPL', 'ld.pl.VLLPL', 'dl.G2.PL', 'dl.load.pedL', 'dl.G2.pedL'].map(id => !!document.getElementById('st-' + id)),
      tbl: [...document.querySelectorAll('.tbl tr')].filter(tr => /PL pedestrian live load/.test(tr.textContent)).map(tr => tr.textContent)[0] || '', Mll: m.Mll, Mu: R.MuMid, s3: m.s3Bot, Sbc: R.cp.Sbc, links: [...document.querySelectorAll('#card-pl a.wk')].map(a => a.getAttribute('href')) }; });
  assert.equal(L.pl.mode, 'simple'); assert.ok(Math.abs(L.pl.w - 0.0675) < 1e-12); assert.ok(Math.abs(L.pl.Mmid - 121.5) < 1e-9); assert.ok(Math.abs(L.pl.Vsup - 4.05) < 1e-9);
  assert.match(L.card, /0\.0675 klf/); assert.match(L.card, /121\.5 kip-ft/); assert.match(L.card, /4\.05 kip/); assert.deepEqual(L.steps, L.steps.map(() => true), 'steps on the tab ' + L.steps);
  assert.match(L.tbl, /0\.0675/); assert.ok(L.links.includes('#st-dl.G2.PL') && L.links.includes('#st-ld.pl.MLLPL'));
  assert.ok(Math.abs((L.Mll - before.Mll) / 12 - 121.5) < 1e-6, 'M_LL + M_PL'); assert.ok(Math.abs((L.Mu - before.Mu) / 12 - 212.625) < 1e-6, 'M_u + 1.75 M_PL');
  assert.ok(Math.abs((L.s3 - before.s3) + 0.8 * 121.5 * 12 / L.Sbc) < 1e-9, 'Service III bottom stress');
  ok(`Loads & LLDF: w_PL ${L.pl.w.toFixed(4)} klf, M_PL ${L.pl.Mmid.toFixed(1)} kip-ft, V_PL ${L.pl.Vsup.toFixed(2)} kip; 8 worked steps on the tab; M_u ${(before.Mu / 12).toFixed(1)} → ${(L.Mu / 12).toFixed(1)} kip-ft, Service III f_bot ${before.s3.toFixed(4)} → ${L.s3.toFixed(4)} ksi`);
  await p.evaluate(() => { const a = document.querySelector('#card-pl a.wk[href="#st-ld.pl.M"]'); a.click(); }); await p.waitForTimeout(300);
  assert.ok(await p.evaluate(() => { const s = document.getElementById('st-ld.pl.M'); return !!s && s.getBoundingClientRect().height > 0; }), 'the § opens the step');
  await shot('#card-pl', 'ps-pl-loads-card.png');
  if (SHOT) { const s = await p.$('#st-ld\\.pl\\.MLLPL'); if (s) { const t = await s.evaluateHandle(e => e.closest('details') || e.parentElement); await t.asElement().screenshot({ path: path.join(SHOT, 'ps-pl-steps.png') }); } }
  ok('a § of the pedestrian card opens its worked step');
  // 3. the tabs that take LL+IM + PL
  for (const t of ['str', 'flex', 'shear']) { await otab(t); await until(() => p.evaluate(() => !!document.querySelector('#plTabNote')), 30000, 'note on ' + t);
    assert.equal(await p.evaluate(() => document.querySelector('#plTabNote a.wk').getAttribute('href')), '#st-ld.pl.MLLPL'); }
  await otab('shear'); const sh = await p.evaluate(() => [...document.querySelectorAll('[id^="st-sh."]')].map(e => e.textContent).filter(t => /includes the pedestrian/.test(t)).length);
  assert.ok(sh >= 1, 'the shear step notes the pedestrian load');
  ok('Stresses, Flexure and Shear tabs: the pedestrian note with its § (Loads & LLDF step); the shear step says V_LL+IM includes it');
  // 4. the Report, a utility row, the keys
  await otab('rpt'); await until(() => p.evaluate(() => /Pedestrian live load/.test((document.querySelector('#rptHost') || {}).textContent || '')), 120000, 'the Report');
  const rp = await p.evaluate(() => { const t = document.querySelector('#rptHost').textContent; return { card: /Pedestrian live load \(AASHTO LRFD 10th Ed\. 3\.6\.1\.6\)/.test(t), w: /0\.0675/.test(t), step: /Pedestrian load moment at midspan/.test(t), used: /HL-93 with IM and DF, plus the pedestrian load/.test(t) }; });
  assert.deepEqual(rp, { card: true, w: true, step: true, used: true }, JSON.stringify(rp));
  ok('Report: the loads section has the pedestrian card, w_PL, its worked steps and the live load the checks take');
  const ut = await p.evaluate(() => { const P = PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, a = PSBDesign.inputs(P).loads.wDW; P.xs.dl.extra = [{ name: 'Water main', cat: 'UT', x: 25, plf: 0.06 }];
    localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); return { a, b: PSBDesign.inputs(P).loads.wDW, e: PSBInputCheck.collect(P).errors.length }; });
  assert.equal(ut.e, 0); assert.ok(Math.abs(ut.b - ut.a - 0.012) < 1e-12, 'UT equally (AASHTO method): 0.06 / 5');
  await p.reload(); await p.waitForSelector('#tabBar [data-otab]'); await p.waitForTimeout(300); await itab('xsec'); await p.waitForSelector('#card-dl');
  assert.equal(await p.evaluate(() => document.querySelector('[data-path="xs.dl.extra.0.cat"]').value), 'UT');
  await otab('lds'); await until(() => p.evaluate(() => !!document.getElementById('st-dl.G2.DWt')), 60000, 'the DW + UT step');
  ok(`utility row (UT): the line's DW ${ut.a.toFixed(4)} → ${ut.b.toFixed(4)} klf; step dl.G2.DWt on the Loads & LLDF tab`);
  const keys = await p.evaluate(() => Object.keys(localStorage)); assert.ok(keys.every(k => k.startsWith('psb2.')), 'keys ' + keys.join(', '));
  assert.deepEqual(errs, [], 'console errors: ' + errs.join(' | '));
  ok(`keys written: psb2.* only (${keys.length}); 0 console errors`);
  console.log(`ps-bridge-pl: ${n} checks passed`);
} finally { await b.close(); }
