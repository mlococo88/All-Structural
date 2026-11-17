#!/usr/bin/env node
// Crane Pick Analyzer (apps/crane-pick), QA walkthrough fixes (2026-11-17). Headless Chromium, file://, base map Satellite (tiles mocked
// by tests/lib.mjs). Only the SYNTHETIC fake crane (tests/smoke/crane-fake-wheeled.json) is used.
//   1. a pick whose load is not entered: W = rigging + hook only, "0.0 %"-type results now carry a check flag "Load not entered" (card,
//      Picks tab, Summary count); entering the load removes it; nothing computed changes (the % of chart = W / C as before);
//   2. Drawings sheet index: a Report link whose label names a section ("Report §Site plan (aerial)") reads "Report §<number>", not
//      "Report plan (aerial)§<number>";
//   3. 0 console errors.
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

  assert.deepEqual(errs, []); ok('0 console errors');
  console.log(`crane-qa: ${n} checks passed`);
} catch (e) { console.error(e); console.error('console errors:', errs); process.exitCode = 1; } finally { await b.close(); }
