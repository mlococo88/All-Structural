#!/usr/bin/env node
// Crane Pick Analyzer (apps/crane-pick): the input tabs reorganised (engineer decision 2026-11-17; display only). Headless Chromium,
// file://, base map None. Only the SYNTHETIC fake crane (tests/smoke/crane-fake-wheeled.json) is used.
//   1. an old saved tab preference "tandem" (the removed Girder lifts tab) opens the Lifts tab with the girder-lift card; the tab list;
//   2. Cranes & setups: one crane, three setups (a single pick's and the two cranes of a tandem lift) listed in the crane's card; a setup
//      opens its card there (chart, boom, mode, heading, position, pad, Ground / Terrain links, the lifts using it); Add setup;
//   3. Lifts: the settings together at the top (caution / critical / limit, interpolation, tandem limit, path model, clearance), every
//      lift in one list with its type badge; a pick and a girder lift open their cards; "edit setup" goes back to the setup card;
//      Add single pick / Add girder lift; links from the setup card to a lift; nothing in the saved project changes by browsing;
//   4. 390 px: no page-wide horizontal scroll; 0 console errors.
//   SHOTS=<dir> node tests/smoke/crane-tabs.mjs
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const SHOTS = process.env.SHOTS;
const FILE = path.join(REPO, 'apps/crane-pick/index.html');
const FW = path.join(REPO, 'tests/smoke/crane-fake-wheeled.json');
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, p, errs } = await openPage(FILE, { vw: 1280, vh: 900, ls: { 'crane.ui': '{"base":"none","itab":"tandem"}' } });
const shot = async nm => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, nm + '.png') }); } };
const proj = () => p.evaluate(() => CranePickModel.inputsText(CranePickApp.P));
const sel = () => p.$eval('#inTabs [aria-selected=true]', e => e.dataset.itab);
const txt = s => p.$eval(s, e => e.textContent.replace(/\s+/g, ' '));
try {
  await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(300);
  // 1.
  assert.equal(await sel(), 'lifts', 'old preference "tandem" → Lifts');
  assert.equal(await p.evaluate(() => CranePickApp.ui.liftCard), 'tandem');
  assert.deepEqual(await p.$$eval('#inTabs [data-itab]', a => a.map(x => x.dataset.itab + ':' + x.textContent)),
    ['proj:Project', 'site:Site & map', 'sheets:Plan sheets', 'draw:Site items', 'cranes:Cranes & setups', 'lifts:Lifts', 'ground:Ground', 'route:Route', 'terrain:Terrain']);
  await p.evaluate(() => CranePickApp.showITab('tandem')); assert.equal(await sel(), 'lifts', 'showITab("tandem") → Lifts');
  ok('old tab preference "tandem" opens Lifts (girder-lift card); tabs: … Cranes & setups, Lifts, Ground, Route, Terrain (no Girder lifts)');

  // 2. a crane with three setups, a pick and a tandem girder lift
  await p.evaluate(() => CranePickApp.showITab('cranes'));
  await p.setInputFiles('#crFiles', [FW]); await p.waitForFunction(() => /1 crane loaded/.test(document.querySelector('#crStatus').textContent));
  await p.click('[data-ca=add]'); await p.waitForTimeout(200);
  await p.evaluate(() => { const K = CranePickCranes, M = CranePickModel, c = CranePickApp.P.cranes[0], g = K.groups(c.def).find(g => Object.values(g.configs).some(x => x.id === 'or-full-360')).key;
    CranePickApp.update(P => {
      P.setups.push(M.normSetup({ id: 'u0', name: 'Crane A', craneId: c.id, x: 500, y: 2000, heading: 0, group: g, boom: 60, pad: 100 }));
      [1000, 1100].forEach((x, i) => P.setups.push(M.normSetup({ id: 'u' + (i + 1), name: 'Crane ' + (i + 1), craneId: c.id, x, y: 2000, heading: 0, group: g, boom: 80, pad: 100 })));
      P.picks.push(M.normPick({ id: 'k1', name: 'Pick 1', setupId: 'u0', pick: { x: 500, y: 2030 }, set: { x: 500, y: 2020 }, load: 20000, rigging: 1000, hook: 1000, ded: 0, swing: 'short' }));
      P.tandems.push(M.normTandem({ id: 't1', name: 'Tandem 1', type: 'tandem', slots: ['u1', 'u2'], girder: { L: 60, W: 40000, cg: 28, H: 6 }, hooks: [{ s: 10 }, { s: 50 }], pick: { x: 1050, y: 1980, h: 90, z: 105 }, set: { x: 1050, y: 2000, h: 90, z: 120 } }));
    }, 'setups'); });
  await p.waitForTimeout(200);
  const before = await proj();
  const cid = await p.evaluate(() => CranePickApp.P.cranes[0].id);
  const rows = await p.$$eval(`#crCard-${cid} .crSetups .itRow`, r => r.map(x => x.innerText.replace(/\s+/g, ' ').trim()));
  assert.equal(rows.length, 3, rows.join(' | ')); assert.match(rows[0], /Crane A.*boom 60\.0 ft · 1 lift/); assert.match(rows[1], /Crane 1.*boom 80\.0 ft · 1 lift/);
  assert.match(await txt(`#crCard-${cid} .crSetH`), /Setups of this crane \(3\)/);
  assert.match(await txt(`#crCard-${cid} .crSetups`), /One crane definition, any number of setups.*two identical cranes in a tandem lift = this crane, two setups/);
  await p.click(`#crCard-${cid} [data-selu=u1]`); await p.waitForTimeout(150);
  assert.equal(await sel(), 'cranes'); assert.ok(await p.$(`#crCard-${cid} .crSetups #luCard`), 'the setup card opens inside its crane card');
  for (const id of ['#luName', '#luGroup', '#luBoom', '#luPad', '#luHead', '#luE', '#luN']) assert.ok(await p.isVisible(id), id);
  assert.match(await txt('#luLinks'), /Ground tab.*Terrain tab.*Crane tab/);
  assert.match(await txt('#luUses'), /Lifts using this setup \(1\).*girder lift ?Tandem 1 ?crane 1/);
  await shot('tabs-cranes-setups');
  await p.click('#luLinks [data-la=groundIn]'); await p.waitForTimeout(100); assert.equal(await sel(), 'ground');
  await p.click('#inTabs [data-itab=cranes]'); await p.waitForTimeout(100);
  await p.click('#luUses [data-selt=t1]'); await p.waitForTimeout(200);
  assert.equal(await sel(), 'lifts'); assert.match(await txt('#tlCard'), /Tandem lift: Tandem 1/);
  assert.equal(await proj(), before, 'browsing changes nothing in the project');
  ok('Cranes & setups: one crane, three setups listed in its card (one definition, many setups); the setup card opens there (chart, boom, heading, position, pad; Ground / Terrain / Crane links; lifts using it); a girder lift link opens it on Lifts');

  // 3. Lifts
  for (const id of ['#lsCaution', '#lsCritical', '#lsLimit', '#lsInterp', '#tlLimit', '#lsPath', '#lsObst']) assert.ok(await p.$(`[data-pane=lifts] .sec:first-child ${id}`), 'settings: ' + id);
  const list = await p.$$eval('#lfList .itRow', r => r.map(x => x.innerText.replace(/\s+/g, ' ').trim()));
  assert.equal(list.length, 2); assert.match(list[0], /^single pick Pick 1 Crane A · \d/); assert.match(list[1], /^girder lift · 2 cranes Tandem 1 /);
  await shot('tabs-lifts-girder');
  await p.click('#lfList [data-selk=k1]'); await p.waitForTimeout(200);
  assert.ok(await p.$('#lkCard')); assert.equal(await p.$('#tlCard'), null); assert.equal(await p.evaluate(() => CranePickApp.ui.liftCard), 'pick');
  assert.match(await txt('#lkSetup'), /Crane A \(FAKECO.*edit setup/);
  await shot('tabs-lifts-pick');
  await p.evaluate(() => document.querySelector('[data-pane=lifts] .sec').scrollIntoView({ block: 'start' })); await p.waitForTimeout(100); await shot('tabs-lifts-top');
  await p.evaluate(() => document.querySelector('[data-pane=cranes] .crSetups').scrollIntoView({ block: 'start' }));
  await p.click('#lkSetup [data-la=editSetup]'); await p.waitForTimeout(150);
  assert.equal(await sel(), 'cranes'); assert.match(await txt('#luCard'), /Setup: Crane A/);
  await p.click('#inTabs [data-itab=lifts]'); await p.waitForTimeout(100);
  await p.click('#lfList [data-tasel-t=t1]'); await p.waitForTimeout(200);
  assert.ok(await p.$('#tlCard')); assert.equal(await p.$('#lkCard'), null);
  assert.equal(await proj(), before, 'browsing changes nothing in the project');
  await p.selectOption('#lkNewU', 'u2'); await p.click('[data-la=addPickTo]'); await p.waitForTimeout(200);
  let P = await p.evaluate(() => CranePickApp.P); assert.equal(P.picks.length, 2); assert.equal(P.picks[1].setupId, 'u2'); assert.ok(await p.$('#lkCard'));
  await p.click('[data-ta=newS]'); await p.waitForTimeout(200);
  P = await p.evaluate(() => CranePickApp.P); assert.equal(P.tandems.length, 2); assert.equal(P.tandems[1].type, 'single'); assert.match(await txt('#tlCard'), /Girder lift \(one crane\)/);
  assert.equal(await p.$$eval('#lfList .itRow', r => r.length), 4);
  ok('Lifts: settings together (caution / critical / limit, interpolation, tandem limit, path model, clearance); every lift in one list with type badges; pick ↔ girder-lift cards; "edit setup" → the setup card; Add single pick (setup chosen) / Add girder lift');

  // 4. 390 px
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
  for (const t of ['cranes', 'lifts']) { await p.click(`#inTabs [data-itab=${t}]`); await p.waitForTimeout(200);
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll: ' + t); }
  await p.evaluate(() => document.getElementById('inputPanel').scrollIntoView()); await shot('tabs-390-lifts');
  await p.click('#inTabs [data-itab=cranes]'); await p.evaluate(() => { const x = document.querySelector('.crSetups'); if (x) x.scrollIntoView(); }); await p.waitForTimeout(100); await shot('tabs-390-cranes');
  ok('390 px: Cranes & setups and Lifts without sideways scroll');
  const E = errs.filter(e => !/Failed to load resource/.test(e)); assert.deepEqual(E, [], 'console errors'); ok('0 console errors');
  console.log(`\ncrane-tabs: ${n} checks passed`);
} finally { await b.close(); }
