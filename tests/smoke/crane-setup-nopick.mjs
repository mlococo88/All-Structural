#!/usr/bin/env node
// Crane Pick Analyzer (apps/crane-pick): a crane setup without a pick (engineer request 2026-11-17: "Add setup" makes the setup only).
// Headless Chromium, file://, base map None. Only the SYNTHETIC fake crane (tests/smoke/crane-fake-wheeled.json).
//   1. Add setup (place on the map): one setup, no pick; the crane at the map centre, heading 0, the crane's default chart / boom; the map
//      draws the crane with its boom at the neutral pose (along the heading at the chart's mid radius for that boom) and "no lift yet";
//      no "Load not entered" anywhere;
//   2. every output tab (Plan + elevation dock, 3D, Summary, Crane, Picks, Ground, Route, Terrain, Site, Drawings, Report, Manual) with
//      the setup and no lift: drawn, no NaN / undefined, 0 console errors;
//   3. the same setup used only by a girder lift (one crane): the "no lift yet" label goes, the girder lift is evaluated, every tab again;
//   4. Add single pick still makes a pick; "Place for crane 1" on a girder-lift card makes a setup without a pick.
//   SHOTS=<dir> node tests/smoke/crane-setup-nopick.mjs
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const SHOTS = process.env.SHOTS;
const FILE = path.join(REPO, 'apps/crane-pick/index.html');
const FW = path.join(REPO, 'tests/smoke/crane-fake-wheeled.json');
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, p, errs } = await openPage(FILE, { vw: 1280, vh: 900, ls: { 'crane.ui': '{"base":"none","itab":"cranes","dwg":{"aerial":false}}' } });
const shot = async nm => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, nm + '.png') }); } };
const proj = () => p.evaluate(() => CranePickApp.P);
const OTABS = ['plan', 'summary', 'crane', 'picks', 'ground', 'route', 'terrain', 'site', 'dwg', 'man', 'rpt'];
async function everyTab(what) {
  for (const t of OTABS) {
    await p.click(`#tabBar [data-otab=${t}]`); await p.waitForTimeout(t === 'rpt' || t === 'dwg' ? 600 : 250);
    const tx = await p.$eval(`#out [data-opane=${t}]`, e => e.textContent.replace(/\s+/g, ' '));
    assert.ok(tx.length > 20, `${what}: the ${t} tab is drawn`);
    assert.ok(!/\bNaN\b|\bundefined\b/.test(tx), `${what}: NaN / undefined on the ${t} tab: ` + (tx.match(/.{0,80}(NaN|undefined).{0,40}/) || [''])[0]);
    assert.ok(!/Load not entered/.test(tx), `${what}: "Load not entered" on the ${t} tab`);
  }
  // the elevation / 3D dock under the map
  await p.click('#tabBar [data-otab=plan]'); await p.waitForTimeout(250);
  const dock = await p.$eval('#elevDock', e => e.textContent.replace(/\s+/g, ' ')).catch(() => '');
  assert.ok(!/\bNaN\b|\bundefined\b/.test(dock), `${what}: dock text ` + dock.slice(0, 200));
  if (await p.$('[data-elmode="3d"]')) {
    await p.click('[data-elmode="3d"]'); await p.waitForTimeout(1200);
    const st = await p.evaluate(() => CranePickView3D.state); assert.ok(!st.failed, `${what}: 3D ` + JSON.stringify(st));
    if (await p.$('[data-elmode="elev"]')) { await p.click('[data-elmode="elev"]'); await p.waitForTimeout(200); }
  }
  // the DXF of the drawings
  await p.click('#tabBar [data-otab=dwg]'); await p.waitForTimeout(400);
  const dx = await p.evaluate(() => { let got = null; const d0 = SharedDxf.download; SharedDxf.download = (t, f) => { got = { n: t.length, nan: /NaN|undefined/.test(t) }; }; const btn = document.getElementById('dwg_dxf'); if (btn) btn.click(); SharedDxf.download = d0; return got; });
  if (dx) assert.ok(!dx.nan && dx.n > 200, `${what}: DXF ` + JSON.stringify(dx));
  await p.click('#tabBar [data-otab=plan]'); await p.waitForTimeout(200);
}
try {
  await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(300);
  await p.setInputFiles('#crFiles', [FW]); await p.waitForFunction(() => /1 crane loaded/.test(document.querySelector('#crStatus').textContent));
  await p.click('[data-ca=add]'); await p.waitForTimeout(200);
  const ctr = await p.evaluate(() => CranePickMap.toFt(CranePickMap.map.getCenter()));
  // 1.
  await p.click('[data-ca=place]'); await p.waitForTimeout(400);
  let P = await proj(); assert.equal(P.setups.length, 1); assert.equal(P.picks.length, 0, 'no pick'); assert.equal(P.tandems.length, 0);
  const u = P.setups[0]; assert.ok(Math.abs(u.x - ctr.x) < 0.5 && Math.abs(u.y - ctr.y) < 0.5, 'at the map centre'); assert.equal(u.heading, 0);
  assert.ok(u.group && u.boom === 40, 'the crane\'s default chart group and boom: ' + u.group + ' ' + u.boom);
  assert.equal(await p.$eval('#inTabs [aria-selected=true]', e => e.dataset.itab), 'cranes'); assert.ok(await p.isVisible('.crSetups #luCard'));
  assert.match(await p.$eval('#luUses', e => e.textContent.replace(/\s+/g, ' ')).catch(() => ''), /Lifts using this setup \(0\)|no lift/i);
  // the neutral boom: the symbol's boom along the heading (0 = north), tip at the mid radius of the 40 ft boom's rated radii (10 … 30 ft -> 20 ft)
  const sym = await p.evaluate(() => { const u = CranePickApp.P.setups[0], g = CranePickPlace.layers.get(u.id), bl = g.sym.boom.pg.getLatLngs().flat(3).concat(g.sym.boom.pl.getLatLngs().flat(3)).map(ll => CranePickMap.toFt(ll));
    const lbl = g.idle && g.idle.getElement(); return { n: bl.length, maxN: Math.max(...bl.map(q => q.y - u.y)), maxE: Math.max(...bl.map(q => Math.abs(q.x - u.x))), lbl: lbl ? lbl.textContent : '', op: lbl ? getComputedStyle(lbl).opacity : '', tip: CranePickMap.toFt(g.idle.getLatLng()) }; });
  assert.ok(sym.n > 0, 'the boom is drawn'); assert.ok(sym.maxN > 15 && sym.maxN < 25, 'boom tip about 20 ft north: ' + sym.maxN); assert.ok(sym.maxE < 5, 'along the heading: ' + sym.maxE);
  assert.match(sym.lbl, /no lift yet/); assert.equal(sym.op, '1'); assert.ok(Math.abs(sym.tip.y - u.y - 20) < 0.01 && Math.abs(sym.tip.x - u.x) < 0.01, 'label at the tip R = 20 ft');
  assert.equal(await p.$$eval('.crPtP, .crPtS', a => a.length), 0, 'no P / S');
  await p.evaluate(() => CranePickMap.fit([{ x: CranePickApp.P.setups[0].x - 60, y: CranePickApp.P.setups[0].y - 40 }, { x: CranePickApp.P.setups[0].x + 60, y: CranePickApp.P.setups[0].y + 60 }])); await p.waitForTimeout(300);
  await p.evaluate(() => { const x = document.querySelector('.crSetups'); if (x) x.scrollIntoView({ block: 'start' }); }); await p.waitForTimeout(100);
  await shot('setup-nopick');
  ok(`Add setup: 1 setup, 0 picks, at the map centre, heading 0, default chart / boom ${u.boom} ft; neutral boom to R 20.0 ft north, "no lift yet"`);
  // dragging the crane moves the label with the tip
  await p.evaluate(() => { const u = CranePickApp.P.setups[0]; CranePickApp.update(() => { u.heading = 90; }, 'setups', { id: u.id }); }); await p.waitForTimeout(200);
  const t2 = await p.evaluate(() => { const u = CranePickApp.P.setups[0], g = CranePickPlace.layers.get(u.id); const q = CranePickMap.toFt(g.idle.getLatLng()); return { dx: q.x - u.x, dy: q.y - u.y }; });
  assert.ok(Math.abs(t2.dx - 20) < 0.01 && Math.abs(t2.dy) < 0.01, 'heading 90: tip 20 ft east ' + JSON.stringify(t2));
  ok('heading 90°: the neutral boom turns with the carrier (tip 20 ft east)');
  // 2.
  await everyTab('setup, no lift');
  ok('every output tab (Plan + elevation / 3D dock, Summary, Crane, Picks, Ground, Route, Terrain, Site, Drawings + DXF, Manual, Report) with a setup and no lift: drawn, no NaN / undefined, no "Load not entered"');
  // 3. used only by a girder lift (one crane)
  await p.click('#inTabs [data-itab=lifts]'); await p.waitForTimeout(150); await p.click('[data-ta=newS]'); await p.waitForTimeout(300);
  P = await proj(); assert.equal(P.tandems.length, 1); assert.equal(P.tandems[0].slots[0], u.id, 'the girder lift uses the setup'); assert.equal(P.picks.length, 0);
  const op2 = await p.evaluate(() => { const g = CranePickPlace.layers.get(CranePickApp.P.setups[0].id); return getComputedStyle(g.idle.getElement()).opacity; });
  assert.equal(op2, '0', 'no "no lift yet" once a girder lift uses the setup');
  await everyTab('setup used by a girder lift only');
  ok('the setup used only by a girder lift (one crane): "no lift yet" hidden; every output tab drawn, no NaN / undefined');
  // 4.
  await p.click('#inTabs [data-itab=lifts]'); await p.waitForTimeout(150);
  await p.click('[data-ta=place0]'); await p.waitForTimeout(300);
  P = await proj(); assert.equal(P.setups.length, 2, 'Place for crane 1 makes a setup'); assert.equal(P.picks.length, 0, '… without a pick');
  await p.click('[data-la=addPickTo]'); await p.waitForTimeout(200);
  P = await proj(); assert.equal(P.picks.length, 1, 'Add single pick'); assert.ok(await p.$('#lkCard'));
  ok('Place for crane 1 (girder lift): a setup, no pick; Add single pick: one pick');
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300); await p.click('#inTabs [data-itab=cranes]'); await p.waitForTimeout(200);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll at 390 px');
  const E = errs.filter(e => !/Failed to load resource|ERR_FAILED|net::/.test(e)); assert.deepEqual(E, [], 'console errors'); ok('390 px; 0 console errors');
  console.log(`\ncrane-setup-nopick: ${n} checks passed`);
} finally { await b.close(); }
