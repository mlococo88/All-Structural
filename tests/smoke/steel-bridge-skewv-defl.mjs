#!/usr/bin/env node
// Browser smoke test of the engineer's decisions of 2026-11-23 in apps/steel-bridge/index.html (headless Chromium, tests/lib.mjs openPage).
// A made-up project: the built-in one-girder project skewed 30° at every support, with a second, heavier exterior girder type on G1.
//   1. Loads input tab, Distribution: the drop-down "Shear skew correction along the girder" has two options, "Whole length" selected for a
//      project saved without the field; its note cites 4.6.2.2.3c; nothing is written until the user changes it;
//   2. choosing "Tapered" saves xs.lldf.skewVx = 'taper'; the Analysis tab shows the taper note and the worked step an.gVx.s1, the Shear
//      and Fatigue tabs their notes; the Loads & LLDF tab the step df.s0.rVx;
//   3. Fatigue & studs: the edition note on the stud card and above the stud steps (10th Ed. only; 9th Ed. differs);
//   4. Deflection: the bridge-stiffness note and the step an.defl.EI1; G1 (exterior) and G2 (interior) show the same Δ_LL.
//   0 console errors.   node tests/smoke/steel-bridge-skewv-defl.mjs [--shots <dir>]
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';
import { SBD_DEFAULT } from './sbd-seed.mjs';

const av = process.argv.slice(2), shots = av.includes('--shots') ? av[av.indexOf('--shots') + 1] : null;
if (shots) fs.mkdirSync(shots, { recursive: true });
const FILE = path.join(REPO, 'apps/steel-bridge/index.html'), t0 = Date.now();
const settle = (p, t = 480000) => p.waitForFunction(() => !document.querySelector('#out .alert.stale:not([hidden])') && !/Calculating|updating/.test((document.querySelector('#autoMsg') || {}).textContent || ''), null, { timeout: t });
const P0 = JSON.parse(JSON.stringify(SBD_DEFAULT)); P0.xs.skews = P0.xs.skews.map(() => 30);
{ const e = JSON.parse(JSON.stringify(P0.girders[0])); e.id = 'G2'; e.label = 'Exterior'; e.position = 'exterior'; e.beff = 96; e.line = 0; e.segments.forEach(s => { s.botT += 0.5; }); P0.girders.push(e); }
assert.equal(P0.xs.lldf.skewVx, undefined);
const otab = async (p, k, sel) => { await p.click(`#tabBar [data-otab="${k}"]`); await settle(p); if (sel) await p.waitForSelector(sel, { timeout: 480000 }); };

const { b, p, errs } = await openPage(FILE, { vw: 1440, vh: 1000, ls: { 'sbd2.project.current': JSON.stringify(P0, null, 2) } });
try {
  await p.waitForSelector('#inTabs [data-itab="loads"]'); await p.click('#inTabs [data-itab="loads"]');
  // SET (2026-11-26): the drop-down moved to the Settings window (Live-load distribution); the window's copy edits the same input
  const S = '[id="sbs-i_xs.lldf.skewVx"]'; await p.waitForSelector('[id="i_xs.lldf.skewVx"]', { state: 'attached' });
  const setOpen = async () => { await p.click('#sbGear'); await p.click('[data-sbsg="lldf"]'); await p.waitForSelector(S); };
  await setOpen();
  // 1. the drop-down
  const d = await p.$eval(S, s => ({ opts: [...s.options].map(o => [o.value, o.textContent]), val: s.value, label: s.closest('.fRow').querySelector('label').textContent }));
  assert.deepEqual(d.opts, [['whole', 'Whole length'], ['taper', 'Tapered: full at the support, 1.0 at mid-span']]); assert.equal(d.val, 'whole'); assert.equal(d.label, 'Shear skew correction along the girder');
  const note = await p.$eval('#ld-skewvx-note', n => n.textContent); assert.match(note, /4\.6\.2\.2\.3c/); assert.match(note, /end region only/);
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('sbd2.project.current')).xs.lldf.skewVx), undefined, 'nothing written before a change');
  await p.click('#sbSetSave'); await otab(p, 'an', '#out table'); assert.equal(await p.$('#an-skewvx'), null, 'whole length: no taper note');
  if (shots) { await setOpen(); await p.$eval(S, s => s.scrollIntoView({ block: 'center' })); await p.screenshot({ path: path.join(shots, 'skewvx-whole.png') }); await p.click('#sbSetSave'); }
  // 2. tapered
  await setOpen(); await p.selectOption(S, 'taper'); await p.click('#sbSetSave'); await settle(p);
  await p.waitForFunction(() => (JSON.parse(localStorage.getItem('sbd2.project.current') || '{}').xs || { lldf: {} }).lldf.skewVx === 'taper', null, { timeout: 60000 });
  await otab(p, 'an', '#an-skewvx');
  assert.match(await p.$eval('#an-skewvx', n => n.textContent), /tapered/); assert.ok(await p.$('[id="st-an.gVx.s1"]'), 'step an.gVx.s1 on the Analysis tab');
  const g = await p.evaluate(() => { const P = JSON.parse(localStorage.getItem('sbd2.project.current')), R = window.SBDAnalysis.analyzeGirder(P, 0), i = R.x.findIndex(x => Math.abs(x - 55) < 1e-9), D = R.df.spans[0]; return { gx: R.ll.gVR[i], want: D.gV / D.rV, step: R.steps.find(s => s.id === 'an.gVx.s1').value, rV: D.rV }; });
  assert.ok(g.rV > 1 && Math.abs(g.gx - g.want) < 1e-12, 'mid-span of span 1: the correction is 1.0');
  if (shots) { await p.$eval('#an-skewvx', n => n.scrollIntoView({ block: 'center' })); await p.screenshot({ path: path.join(shots, 'skewvx-analysis.png') }); }
  await otab(p, 'shear', '#sh-skewvx'); await otab(p, 'loads'); await p.waitForSelector('[id="st-df.s0.rVx"]', { state: 'attached', timeout: 480000 });
  // 3. the stud edition note
  await otab(p, 'fat', '#sc-edition');
  const ed = await p.$eval('#sc-edition', n => n.textContent); assert.match(ed, /AASHTO LRFD 10th Ed\. \(2024\) only/); assert.match(ed, /9th Ed\. has different stud requirements/);
  assert.ok(await p.$('#sc-skewvx'), 'taper note on the stud card'); assert.ok(await p.$('#sc-edition-steps'), 'the note above the stud steps');
  if (shots) { await p.$eval('#sc-edition', n => n.scrollIntoView({ block: 'start' })); await p.screenshot({ path: path.join(shots, 'stud-edition.png') }); }
  // 4. deflection on the bridge stiffness
  await otab(p, 'defl', '#df-bridge-ei');
  assert.match(await p.$eval('#df-bridge-ei', n => n.textContent), /shared equally \(2\.5\.2\.6\.2\)/); assert.ok(await p.$('[id="st-an.defl.EI1"]'));
  const dl = await p.evaluate(() => { const P = JSON.parse(localStorage.getItem('sbd2.project.current')), a = window.SBDAnalysis.analyzeGirder(P, 0), e = window.SBDAnalysis.analyzeGirder(P, 1); return { a: a.lld.map(q => q.d), e: e.lld.map(q => q.d), same: a.bEI.same, Io: a.lld[1].EI.Iown, Ia: a.lld[1].EI.Iavg }; });
  assert.equal(dl.same, false); assert.ok(dl.Ia > dl.Io); dl.a.forEach((v, k) => assert.ok(Math.abs(v - dl.e[k]) < 1e-9, `span ${k + 1}: exterior = interior`));
  if (shots) { await p.$eval('#df-bridge-ei', n => n.scrollIntoView({ block: 'center' })); await p.screenshot({ path: path.join(shots, 'defl-bridge-ei.png') }); }
  assert.deepEqual(errs, [], 'console errors');
  console.log(`ok   steel-bridge-skewv-defl: drop-down, taper notes and steps, stud edition note, bridge-stiffness deflection (Δ_LL ${dl.a.map(v => v.toFixed(3)).join(' / ')} in, both girders); 0 console errors; ${((Date.now() - t0) / 1000).toFixed(0)} s`);
} catch (e) { console.log('FAIL steel-bridge-skewv-defl\n' + ((e && e.stack) || e) + '\nconsole: ' + errs.join(' | ')); process.exitCode = 1; }
finally { await b.close(); }
