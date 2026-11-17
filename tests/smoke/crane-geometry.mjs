#!/usr/bin/env node
// Crane Pick Analyzer (apps/crane-pick), 2026-11-17: the manufacturer GEOMETRY block in the app. Headless Chromium, file://, base map None.
// SYNTHETIC fake crane (tests/smoke/crane-fake-wheeled.json + a made-up geometry block: floats 13 ft ahead / 11 ft behind the rotation
// centre, spread full 22 ft, mid 15 ft, square 2.5 ft floats), the C4 hand-check weights of case A.
//   1. Crane tab: "6. Dimension check" (front float 13.00 = manufacturer, page 2), "7. Float centres" (FL x 13.00, y 11.00; E / N);
//      a project copy WITHOUT the geometry block is flagged;
//   2. setup card: "Outriggers drawn at" mid (drawing only) -> the warning, the map labels toggle (4 labels), the floats move to ±7.5 ft;
//   3. mats drawn on the map (the symbol's mat group); stake-out CSV downloads (rows: centre, 4 floats, pick, set);
//   4. Drawings: the lift plan has the clearance dimension rows and the support rows; 390 px no page-wide scroll; 0 console errors.
//   SHOTS=<dir> node tests/smoke/crane-geometry.mjs
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const SHOTS = process.env.SHOTS;
const FILE = path.join(REPO, 'apps/crane-pick/index.html');
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const E = (v, basis) => ({ value: v, unit: 'ft', as_printed: `${v} ft (fake)`, page: 2, basis: basis || 'printed' });
const raw = JSON.parse(fs.readFileSync(path.join(REPO, 'tests/smoke/crane-fake-wheeled.json'), 'utf8'));
raw.app_inputs = Object.assign({}, raw.app_inputs, { ph4: { carrierLb: 40000, carrierCg: 0, upperLb: 30000, upperCg: 0, boomLb: 6000, cwRad: 10 } });
const plain = JSON.parse(JSON.stringify(raw)); plain.model = plain.model + ' NOGEO';
raw.geometry = { schema: 'crane-pick.geometry.v1', frame: 'fake', verify: 'fake', outriggers: { x_front: E(13), x_rear: E(11), spreads: { full: E(22), mid: E(15) }, float: { shape: 'square', size: E(2.5) } },
  carrier: { front: E(18), rear: E(16), width: E(9.5), axles: [E(8), E(3), E(-5, 'scaled')] }, counterweight: { tail_radius: E(16) } };
const T = process.env.TMPDIR || '/tmp', FG = path.join(T, 'crane-fake-geo.json'), FP = path.join(T, 'crane-fake-nogeo.json');
fs.writeFileSync(FG, JSON.stringify(raw)); fs.writeFileSync(FP, JSON.stringify(plain));
const { b, p, errs } = await openPage(FILE, { vw: 1280, vh: 900, ls: { 'crane.ui': '{"base":"none","itab":"cranes"}' } });
const shot = async nm => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, nm + '.png'), fullPage: false }); } };
try {
  await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(300);
  await p.setInputFiles('#crFiles', [FG, FP]); await p.waitForFunction(() => /2 cranes loaded/.test(document.querySelector('#crStatus').textContent));
  for (let i = 0; i < 2; i++) { await p.click('[data-ca=add] >> nth=0'); await p.waitForTimeout(250); }
  assert.equal(await p.evaluate(() => CranePickApp.P.cranes.length), 2);
  await p.evaluate(() => { const K = CranePickCranes, M = CranePickModel, A = CranePickApp, cs = A.P.cranes, cg = cs.find(c => K.geometryOf(c.def)), cp = cs.find(c => !K.geometryOf(c.def));
    const g = c => K.groups(c.def).find(g => Object.values(g.configs).some(x => x.id === 'or-full-360')).key;
    A.update(P => {
      P.setups.push(M.normSetup({ id: 'u0', name: 'Crane G', craneId: cg.id, x: 500, y: 2000, heading: 0, group: g(cg), boom: 60, pad: 100, ground: { mat: { type: 'timber', B: 4, L: 6, t: 12, Fb: 1200, Fv: 150 }, qa: 6000 } }));
      P.setups.push(M.normSetup({ id: 'u9', name: 'Crane P', craneId: cp.id, x: 700, y: 2000, heading: 0, group: g(cp), boom: 60, pad: 100 }));
      P.picks.push(M.normPick({ id: 'k1', name: 'Pick 1', setupId: 'u0', pick: { x: 500, y: 2030 }, set: { x: 500, y: 2020 }, load: 20000, rigging: 1000, hook: 1000, ded: 0, swing: 'short' }));
      P.items.push(M.normItem({ id: 'o1', type: 'obst', name: 'Shed', pts: [{ x: 520, y: 2005 }, { x: 530, y: 2005 }, { x: 530, y: 2015 }, { x: 520, y: 2015 }], height: 10 }));
    }, 'setups'); });
  ok('a project: crane G (geometry block) with a pick and a shed, crane P (no geometry block)');
  // 1. Crane tab
  await p.evaluate(() => CranePickApp.showOTab('crane')); await p.waitForSelector('#crnDimTbl');
  const row = await p.$$eval('#crnDimTbl tr', rs => rs.map(r => r.textContent)); assert.ok(row.some(t => /Front float centre line.*13\.00.*13\.00.*p\. 2.*printed.*matches/.test(t)), row.join('\n'));
  const fl = await p.$$eval('#crnFloatTbl tbody tr', rs => rs.map(r => r.textContent)); assert.equal(fl.length, 4); assert.match(fl[0], /^FL.*13\.00.*11\.00/);
  await shot('geo-cranetab-dimcheck');
  ok('Crane tab: dimension check (front float 13.00 = manufacturer p. 2) and the float table (FL x 13.00, y 11.00)');
  const opts = await p.$$eval('#crnSel option', o => o.map(x => x.value)); await p.selectOption('#crnSel', opts.find(v => v.split('|')[1] === 'u9')); await p.waitForTimeout(200);
  assert.match(await p.textContent('#crnDim'), /project copy has no manufacturer geometry block/);
  ok('a project copy without the geometry block is flagged');
  // 2. setup card
  await p.evaluate(() => { CranePickApp.showITab('lifts'); CranePickPlace.select('u0', null); }); await p.waitForSelector('#luSpread');
  await p.selectOption('#luSpread', 'mid'); await p.waitForTimeout(300);
  assert.match(await p.textContent('#luCard'), /Drawn at "mid".*Not valid for this setup/s);
  const ly = await p.evaluate(() => CranePickLift.footprint(CranePickApp.P.cranes.find(c => CranePickCranes.geometryOf(c.def)).def, CranePickApp.P.setups[0]).floatC.map(q => q.ly));
  assert.equal(JSON.stringify(ly), JSON.stringify([7.5, -7.5, 7.5, -7.5]));
  await p.check('#luFlLbl'); await p.waitForTimeout(300);
  const nl = await p.$$eval('.crGrLbl .gl', a => a.filter(x => /^FL x |^FR x |^RL x |^RR x /.test(x.textContent)).length); assert.ok(nl >= 4, 'float labels ' + nl);
  await shot('geo-map-mid-labels');
  await p.selectOption('#luSpread', ''); await p.waitForTimeout(200);
  ok('setup card: drawn-only spread warned, floats at ±7.5 ft; float coordinate labels on the map');
  // 3. mats on the map; stake-out CSV
  assert.ok(await p.$$eval('.crSym-mat', a => a.length) >= 1, 'mat layer');
  await p.evaluate(() => CranePickApp.showOTab('crane')); await p.waitForSelector('#crnDimTbl');
  const opts2 = await p.$$eval('#crnSel option', o => o.map(x => x.value)); await p.selectOption('#crnSel', opts2.find(v => v.split('|')[1] === 'u0')); await p.waitForTimeout(200);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-cg=csv]')]); const csv = fs.readFileSync(await dl.path(), 'utf8').trim().split(/\r\n/);
  assert.ok(csv.length >= 1 + 1 + 4 + 2, csv.length); assert.match(csv[2], /"Crane G FL"/);
  ok('mats on the map; stake-out CSV: header, centre, 4 floats, pick and set');
  // 4. Drawings: lift plan rows
  const rows = await p.evaluate(() => { const r = CranePickDrawSet.build(CranePickApp.P, { evalPick: k => CranePickPlace.evalPick(k), evalT: () => null, evalRoute: () => null, date: '2026-11-17' }, { paper: 'D' });
    return r.D.E.filter(e => e.t === 'TEXT').map(e => e.s).join('\n'); });
  assert.match(rows, /CLEARANCE FL/); assert.match(rows, /SUPPORTS \(X ALONG CARRIER/); assert.match(rows, /FLOAT \/ TRACK LOCATIONS/);
  ok('Drawings: lift plan clearance-dimension and support rows; ground sheet location table');
  await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(300);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no page-wide horizontal scroll');
  await p.setViewportSize({ width: 1280, height: 900 });
  assert.equal(errs.length, 0, errs.join('\n')); ok('390 px: no page-wide horizontal scroll; 0 console errors');
  console.log(`crane-geometry smoke: ${n} passed`);
} finally { await b.close(); }
