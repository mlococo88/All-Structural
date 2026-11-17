#!/usr/bin/env node
// Crane Pick Analyzer (apps/crane-pick), QA walkthrough fixes (2026-11-17). Headless Chromium, file://, base map Satellite (tiles mocked
// by tests/lib.mjs). Only the SYNTHETIC fake crane (tests/smoke/crane-fake-wheeled.json) is used.
//   1. a pick whose load is not entered: W = rigging + hook only, "0.0 %"-type results now carry a check flag "Load not entered" (card,
//      Picks tab, Summary count); entering the load removes it; nothing computed changes (the % of chart = W / C as before);
//   2. Drawings sheet index: a Report link whose label names a section ("Report §Site plan (aerial)") reads "Report §<number>", not
//      "Report plan (aerial)§<number>";
//   3. a plan sheet aligned to the map and then rotated by hand: a warning that the placement no longer matches the alignment (card,
//      Site tab, Report; hand check 1.561 ft); untouched: none;
//   4. 0 console errors.
//   SHOTS=<dir> node tests/smoke/crane-qa.mjs
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const SHOTS = process.env.SHOTS;
const FILE = path.join(REPO, 'apps/crane-pick/index.html');
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs ${b} (tol ${tol})`);
const FW = path.join(REPO, 'tests/smoke/crane-fake-wheeled.json');
const { b, p, errs } = await openPage(FILE, { vw: 1280, vh: 900, ls: { 'crane.ui': '{"base":"sat","itab":"cranes","dwg":{"aerial":true}}' } });
const shot = async nm => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, nm + '.png') }); } };
try {
  await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(300);
  await p.setInputFiles('#crFiles', [FW]); await p.waitForFunction(() => /1 crane loaded/.test(document.querySelector('#crStatus').textContent));
  await p.click('[data-ca=add]'); await p.waitForTimeout(200);
  await p.evaluate(() => { const K = CranePickCranes, M = CranePickModel, c = CranePickApp.P.cranes[0], g = K.groups(c.def).find(g => Object.values(g.configs).some(x => x.id === 'or-full-360')).key;
    CranePickApp.update(P => {
      P.title = Object.assign({}, P.title, { name: 'QA SMOKE' });
      P.setups.push(M.normSetup({ id: 'u0', name: 'Crane A', craneId: c.id, x: 500, y: 2000, heading: 0, group: g, boom: 60 }));
      P.picks.push(M.normPick({ id: 'k1', name: 'Pick 1', setupId: 'u0', pick: { x: 500, y: 2030 }, set: { x: 500, y: 2020 }, load: null, rigging: 1000, hook: 1000, ded: 0, swing: 'short' }));
    }, 'setups'); });
  // 1. no load entered
  const ev = () => p.evaluate(() => { const e = CranePickPlace.evalPick(CranePickApp.P.picks[0]); return { W: e.W, C: e.gov.C, pct: e.gov.pct, flags: e.flags.map(f => f.level + ': ' + f.text) }; });
  let e = await ev();
  assert.equal(e.W, 2000); near(e.pct, 2000 / e.C * 100, 1e-9, 'W / C unchanged');
  assert.equal(e.flags.filter(f => /Load not entered/.test(f)).length, 1); assert.match(e.flags[0], /^warn: Load not entered: W = 2,000 lb \(rigging, hook block and other deductions only\)/);
  await p.click('#inTabs [data-itab=lifts]'); await p.evaluate(() => CranePickPlace.select('u0', 'k1')); await p.waitForTimeout(300); assert.match(await p.$eval('#lfRes', d => d.innerText), /Load not entered/);
  await p.click('#tabBar [data-otab=picks]'); await p.waitForTimeout(300); assert.ok((await p.$$eval('#out [data-opane=picks] .lfDot.lf-warn', a => a.map(x => x.title))).some(t => /Load not entered/.test(t)));
  await p.click('#tabBar [data-otab=summary]'); await p.waitForTimeout(300); const sm = await p.$$eval('#smTbl tbody tr td', t => t.map(x => x.innerText.trim())); assert.ok(sm.some(t => /▲/.test(t)), sm.join(' | '));
  await shot('qa-noload-summary');
  await p.evaluate(() => CranePickApp.update(P => { P.picks[0].load = 20000; }, 'lifts')); await p.waitForTimeout(200);
  e = await ev(); assert.equal(e.W, 22000); assert.ok(!e.flags.some(f => /Load not entered/.test(f)));
  ok(`no load entered: check flag "Load not entered" (card, Picks, Summary), % of chart = W / C unchanged (${(2000 / e.C * 100).toFixed(1)} %); load 20,000 lb entered: flag gone`);

  // 2. Drawings index: Report links that name a section
  await p.click('#tabBar [data-otab=dwg]'); await p.waitForSelector('#dwgIdx'); await p.waitForTimeout(300);
  const idx = await p.$$eval('#dwgIdx tbody tr', r => r.map(x => x.innerText.replace(/\s+/g, ' ')));
  const aer = idx.filter(t => /SITE PLAN - AERIAL/.test(t)); assert.ok(aer.length >= 1, idx.join(' | '));
  aer.forEach(t => { assert.match(t, /Report §\d+(\.\d+)?/, t); assert.doesNotMatch(t, /Report plan/, t); });
  idx.forEach(t => assert.doesNotMatch(t, /Report [a-z][^§]*§/, t));
  ok(`Drawings index: the aerial sheets link "Report §n" (${aer.length} rows), no "Report plan (aerial)§n"`);

  // 3. a plan sheet aligned to the map, then rotated by hand: the alignment record no longer gives the placement -> a warning (card,
  //    Site tab, Report); aligned and untouched: no warning. Synthetic sheet (no image; the "not stored" notice is expected).
  const dr = await p.evaluate(() => {
    const G = CranePickGeo, M = CranePickModel, al = { p1: { px: 100, py: 100 }, p2: { px: 900, py: 500 }, m1: { x: 1000, y: 3000 }, m2: { x: 1080, y: 2960 }, keep: 'pts' };
    const r = G.align2(al.p1, al.p2, al.m1, al.m2, 1000, 600);
    CranePickApp.update(P => { P.sheets.push(M.normSheet({ id: 'sq', name: 'QA sheet', kind: 'image', page: 1, w: 1000, h: 600, place: r.place, opacity: 0.5, basis: 'align', align: al })); }, 'sheets');
    const s = () => CranePickApp.P.sheets.find(x => x.id === 'sq'), d0 = CranePickSheets.alignDrift(s());
    const back = CranePickModel.normalize(JSON.parse(JSON.stringify(CranePickApp.P))).sheets.find(x => x.id === 'sq');   // the record survives save / load
    CranePickApp.update(() => { s().place = G.rotateAbout(s().place, s().place.rot + 2 * Math.PI / 180, 500, 300); }, 'sheets');   // the rotation field: +2° about the centre
    const d1 = CranePickSheets.alignDrift(s()), rpt = SharedReport.text(SharedReport.build(CranePickReport.model(CranePickApp.P)));
    return { d0, d1, kept: !!(back && back.align && back.basis === 'align'), rpt: /placement no longer matches the alignment/.test(rpt) };
  });
  assert.equal(dr.d0, null, 'aligned, untouched: no drift'); assert.ok(dr.kept, 'align record kept by normalize');
  // hand check: +2° about the centre (500, 300) px; A (100, 100) is 447.2 px from it; s = |A'B'| / |AB| = 89.443 / 894.43 = 0.1 ft/px
  // -> A moves 2 × 0.1 × 447.21 × sin(1°) = 1.561 ft; B (900, 500): also 447.2 px -> 1.561 ft
  near(dr.d1.a, 1.561, 0.002, 'A drift'); near(dr.d1.b, 1.561, 0.002, 'B drift'); assert.ok(dr.rpt, 'Report note');
  await p.click('#tabBar [data-otab=site]'); await p.waitForTimeout(300); assert.match(await p.$eval('#out [data-opane=site]', d => d.innerText), /⚠ The placement no longer matches the alignment[^\n]*A is now 1\.56 ft and B 1\.56 ft/);
  await p.click('#inTabs [data-itab=sheets]'); await p.evaluate(() => CranePickSheets.select('sq')); await p.waitForTimeout(300);
  assert.match(await p.$eval('[data-pane=sheets]', d => d.innerText), /placement no longer matches the alignment/); await shot('qa-sheet-drift');
  ok(`plan sheet aligned then rotated 2° by hand: drift A ${dr.d1.a.toFixed(3)} / B ${dr.d1.b.toFixed(3)} ft (hand 1.561) -> warning on the card, the Site tab and the Report; untouched: none`);
  errs.splice(0, errs.length, ...errs.filter(e => !/not stored|ERR_FILE_NOT_FOUND/.test(e)));

  assert.deepEqual(errs, []); ok('0 console errors');
  console.log(`crane-qa: ${n} checks passed`);
} catch (e) { console.error(e); console.error('console errors:', errs); process.exitCode = 1; } finally { await b.close(); }
