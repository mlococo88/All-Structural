#!/usr/bin/env node
// Crane Pick Analyzer (apps/crane-pick), C7: the Drawings tab, the Summary tab and the Report's §1 / §2 / order. Headless Chromium, file://,
// base map None. Only the SYNTHETIC fake crane (tests/smoke/crane-fake-wheeled.json) is used, with the C4 hand-check weights of case A.
//   1. a project with a single pick (crane A, boom 60, pick 30 ft over the front: 56.4 % of chart; timber mat 4 x 4 x 12 in, q_a 4 ksf: front
//      float 41.08 kip), a tandem girder lift (the C5 hand case: 88.9 % / 74.1 %) and a trucking route delivering the girder;
//   2. Summary tab: one row per crane of each lift + the route = the engine values; its links (worked, Report, drawing, map);
//   3. Drawings tab: every sheet renders (cover, notes, lift plan, tandem plan, rigging, ground, route), the index links, paper B,
//      Download DXF (valid, structure check), Print all = one page per sheet, Print sheet = 1;
//   4. Report: §1 Summary (the lift table, § links), §2 Basis, the section order, figures numbered, no unresolved keys, no NaN;
//   5. 390 px: no page-wide horizontal scroll; 0 console errors.
//   SHOTS=<dir> node tests/smoke/crane-drawings.mjs
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const SHOTS = process.env.SHOTS;
const FILE = path.join(REPO, 'apps/crane-pick/index.html');
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs ${b} (tol ${tol})`);
const raw = JSON.parse(fs.readFileSync(path.join(REPO, 'tests/smoke/crane-fake-wheeled.json'), 'utf8'));
raw.app_inputs = Object.assign({}, raw.app_inputs, { ph4: { carrierLb: 40000, carrierCg: 0, upperLb: 30000, upperCg: 0, boomLb: 6000, cwRad: 10 } });
const FW = path.join(process.env.TMPDIR || '/tmp', 'crane-fake-wheeled-ph4.json'); fs.writeFileSync(FW, JSON.stringify(raw));
const { b, p, errs } = await openPage(FILE, { vw: 1280, vh: 900, ls: { 'crane.ui': '{"base":"none","itab":"cranes","dwg":{"aerial":false}}' } });
const shot = async nm => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, nm + '.png') }); } };
const rowsOf = sel => p.$$eval(sel + ' tbody tr', r => r.map(x => [...x.querySelectorAll('td')].map(t => t.innerText.trim())));
try {
  await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(300);
  await p.setInputFiles('#crFiles', [FW]); await p.waitForFunction(() => /1 crane loaded/.test(document.querySelector('#crStatus').textContent));
  await p.click('[data-ca=add]'); await p.waitForTimeout(200);
  await p.evaluate(() => { const K = CranePickCranes, M = CranePickModel, c = CranePickApp.P.cranes[0], g = K.groups(c.def).find(g => Object.values(g.configs).some(x => x.id === 'or-full-360')).key;
    CranePickApp.update(P => {
      P.title = Object.assign({}, P.title, { name: 'SMOKE LIFT PLAN', number: 'S-7', by: 'ABC', checker: 'DEF' });
      P.setups.push(M.normSetup({ id: 'u0', name: 'Crane A', craneId: c.id, x: 500, y: 2000, heading: 0, group: g, boom: 60, pad: 100, ground: { mat: { type: 'timber', B: 4, L: 4, t: 12, Fb: 1200, Fv: 150, E: 1.2e6 }, qa: 4000 } }));
      [1000, 1100].forEach((x, i) => P.setups.push(M.normSetup({ id: 'u' + (i + 1), name: 'Crane ' + (i + 1), craneId: c.id, x, y: 2000, heading: 0, group: g, boom: 80, pad: 100 })));
      P.picks.push(M.normPick({ id: 'k1', name: 'Pick 1', setupId: 'u0', pick: { x: 500, y: 2030 }, set: { x: 500, y: 2020 }, load: 20000, rigging: 1000, hook: 1000, ded: 0, swing: 'short' }));
      P.tandems.push(M.normTandem({ id: 't1', name: 'Tandem 1', type: 'tandem', slots: ['u1', 'u2'], girder: { L: 60, W: 40000, cg: 28, H: 6 },
        hooks: [{ s: 10, rig: 1000, hook: 1000, rigH: 10, blk: 4 }, { s: 50, rig: 1000, hook: 1000, rigH: 10, blk: 4 }], pick: { x: 1050, y: 1980, h: 90, z: 105 }, set: { x: 1050, y: 2000, h: 90, z: 120 } }));
      P.routes.push(M.normRoute({ id: 'r1', name: 'Route 1', pts: [{ x: 900, y: 1700 }, { x: 1050, y: 1700 }, { x: 1050, y: 1990 }], rad: [null, 80, null], tandemId: 't1',
        veh: { type: 'semi', L1: 20, e: 1, L2: 40, Wtr: 20000, xt: 8, Wtl: 15000, xtl: 25, nS: 1, nD: 2, nR: 3, tS: 2, tD: 4, tR: 4 }, load: { r: 2, h: 6, B: 8 } }));
      P.items.push(M.normItem({ type: 'power', name: 'OH 115 kV', kv: 115, pts: [{ x: 470, y: 2050 }, { x: 560, y: 2045 }] }));
    }, 'setups'); });
  ok('a project: one single pick with ground and a mat, one tandem girder lift, one trucking route, a power line');

  // 2. Summary tab
  await p.click('#tabBar [data-otab=summary]'); await p.waitForSelector('#smTbl');
  const sm = await rowsOf('#smTbl');
  assert.equal(sm.length, 3, 'one row per crane: pick (1) + tandem (2)');
  assert.deepEqual([sm[0][0], sm[0][2], sm[0][6], sm[0][7]], ['Pick 1', '56.4 %', '41.08 kip (front left)', '0.73']);
  assert.match(sm[0][5], /^OH 115 kV: \d+\.\d\d ft \(boom\)/); assert.match(sm[0][3], /within the chart/);
  assert.deepEqual([sm[1][0], sm[1][2], sm[2][2]], ['Tandem 1', '88.9 %', '74.1 %']); assert.match(sm[1][3], /over the tandem limit/);
  const eng = await p.evaluate(() => { const ev = CranePickPlace.evalPick(CranePickApp.P.picks[0]), r = CranePickTandemUI.evalT(CranePickApp.P.tandems[0]), ro = CranePickRouteUI.evalRoute(CranePickApp.P.routes[0]);
    return { pct: ev.gov.pct, fl: ev.ground.max[0].load, t: r.gov.map(g => g.c.pct), gross: ro.ax.gross, ot: ro.otMax }; });
  near(eng.pct, 56.41, 0.01); near(eng.fl, 41083.33, 0.01); near(eng.t[0], 88.889, 1e-3); near(eng.gross, 75000, 1e-6);
  const sr = await rowsOf('#smRoutes'); assert.equal(sr.length, 1); assert.deepEqual([sr[0][0], sr[0][1], sr[0][3], sr[0][4]], ['Route 1', 'Tandem 1', '75,000', eng.ot.toFixed(2)]);
  await shot('c7-summary');
  await p.click('#smTbl tr:first-child [data-sm=work]'); await p.waitForTimeout(200); assert.equal(await p.evaluate(() => CranePickApp.ui.otab), 'picks'); assert.ok(await p.$eval('#pk-k1', d => d.open));
  await p.click('#tabBar [data-otab=summary]'); await p.click('#smTbl tr:first-child [data-sm=rpt]'); await p.waitForTimeout(600); assert.equal(await p.evaluate(() => CranePickApp.ui.otab), 'rpt');
  await p.click('#tabBar [data-otab=summary]'); await p.click('#smTbl tr:nth-child(2) [data-sm=map]'); await p.waitForTimeout(200); assert.equal(await p.evaluate(() => [CranePickApp.ui.otab, CranePickTandemUI.selected].join()), 'plan,t1');
  await p.click('#tabBar [data-otab=summary]'); await p.click('#smTbl tr:nth-child(2) [data-sm=dwg]'); await p.waitForSelector('#dwgIdx'); assert.equal(await p.$eval('#dwg_sheet', s => s.value), 'tlift-t1');
  ok(`Summary tab = engine: Pick 1 56.4 %, 41.08 kip, bearing 0.73; Tandem 1 88.9 % / 74.1 %; Route 1 gross 75,000 lb, OT ${eng.ot.toFixed(2)} ft; links: worked (Picks tab), Report, map (lift selected), drawing (sheet)`);

  // 3. Drawings tab
  const ids = await p.$$eval('#dwg_sheet option', o => o.map(x => x.value));
  assert.deepEqual(ids, ['cover', 'notes', 'lift-k1', 'tlift-t1', 'rig-t1', 'ground', 'route-0', 'routeveh-0', 'crane-u0', 'crane-u1', 'crane-u2']);   // C9: a Crane sheet per setup used by a lift; 2026-11-17: the route's vehicle-and-load sheet
  for (const id of ids) { await p.selectOption('#dwg_sheet', id); await p.waitForTimeout(120); const t = await p.$eval('.dwg-box svg', s => ({ n: s.querySelectorAll('text').length, l: s.querySelectorAll('line,path,polyline,polygon,circle').length })); assert.ok(t.n > 10 && t.l > 5, id + ' ' + JSON.stringify(t)); }
  await p.selectOption('#dwg_sheet', 'lift-k1'); await p.waitForTimeout(150);
  assert.match(await p.$eval('.dwg-box svg', s => s.textContent), /P: R 30\.00 FT, 39,000 LB, 56\.4 %/);
  await shot('c7-drawings-lift');
  const idx = await rowsOf('#dwgIdx'); assert.equal(idx.length, 11); assert.match(idx[2][3], /Picks tab · Lifts input tab · Report §\d+\.\d+/);
  await p.click('#dwgIdx tr:nth-child(3) [data-dgr]'); await p.waitForTimeout(500); assert.equal(await p.evaluate(() => CranePickApp.ui.otab), 'rpt');
  await p.click('#tabBar [data-otab=dwg]'); await p.waitForSelector('#dwgIdx');
  for (const id of ['tlift-t1', 'rig-t1', 'ground', 'route-0', 'cover']) { await p.selectOption('#dwg_sheet', id); await p.waitForTimeout(150); await shot('c7-drawings-' + id); }
  // Download DXF (the download itself stubbed) and the print page counts (window.print stubbed: count the pages in the print box)
  const dx = await p.evaluate(() => { let got = null; const d0 = SharedDxf.download; SharedDxf.download = (t, f) => { got = { n: t.length, f }; }; document.getElementById('dwg_dxf').click(); SharedDxf.download = d0;
    const c = CranePickDrawingsUI.lastDxf; return { got, ok: c.check.ok, errs: c.check.errors, text: c.check.counts.TEXT, layers: c.check.layers.length }; });
  assert.ok(dx.ok, dx.errs.join('; ')); assert.ok(dx.got && /^SMOKE_LIFT_PLAN_lift_plan\.dxf$/.test(dx.got.f), JSON.stringify(dx.got)); assert.ok(dx.text > 200);
  const pr = await p.evaluate(() => { let pages = []; window.print = () => { pages.push(document.querySelectorAll('#sdx-print .sdx-sheet').length); };
    document.getElementById('dwg_printAll').click(); document.getElementById('dwg_print1').click(); window.dispatchEvent(new Event('afterprint')); return { pages, r: CranePickDrawingsUI.lastPrint.pages }; });
  assert.deepEqual(pr.pages, [11, 1]);
  await p.selectOption('#dwg_paper', 'B'); await p.waitForTimeout(300); assert.equal((await p.$$eval('#dwg_sheet option', o => o.length)), 12); assert.match(await p.$eval('[data-opane=dwg] .secHead', h => h.textContent), /12 sheets/);   // 2026-11-17: + the vehicle sheet; the cover index then needs a second B sheet
  await p.selectOption('#dwg_paper', 'D'); await p.waitForTimeout(200);
  ok(`Drawings tab: 11 sheets render (cover, notes, lift plan, tandem plan, rigging, ground, route, route vehicle and load, 3 crane sheets (C9)); index links to the tabs / Report §; Download DXF valid (${dx.text} TEXT, ${dx.layers} layers); Print all = 11 pages, Print sheet = 1; paper B (12 sheets)`);

  // 4. Report
  const rp = await p.evaluate(() => { const m = CranePickReport.model(CranePickApp.P), d = SharedReport.build(m); return { secs: m.sections.map(s => s.title), un: d.unresolved, dup: d.dup, text: SharedReport.text(d), head: m.head }; });
  assert.deepEqual(rp.secs, ['Summary', 'Basis', 'Site', 'Site items', 'Site plan (aerial)', 'Cranes', 'Lifts', 'Tandem lifts', 'Ground', 'Route', 'Elevations']);
  assert.deepEqual(rp.un, []); assert.deepEqual(rp.dup, []); assert.ok(!/NaN|undefined/.test(rp.text));
  assert.match(rp.text, /Summary of every lift[\s\S]*Pick 1[\s\S]*56\.4 %[\s\S]*Tandem 1[\s\S]*88\.9 %[\s\S]*Trucking routes[\s\S]*Route 1/);
  assert.match(rp.text, /General notes \(as on the drawings\)[\s\S]*FAKECO test chart TC-1[\s\S]*29 CFR 1926\.1408 Table A/); assert.match(rp.text, /Figure 1\./); assert.match(rp.text, /Figure 2\./);
  assert.match(rp.text, /Staging serves the girder lift "Tandem 1"[^\n]*§8\.\d/); assert.match(rp.head.left, /LIFT-PLANNING AID/);
  await p.click('#tabBar [data-otab=rpt]'); await p.waitForTimeout(500); await shot('c7-report');
  ok(`Report: ${rp.secs.join(' · ')}; §1 lift table with § links; §2 Basis = the general notes; figures numbered; staging → §Tandem lifts; no unresolved keys, no NaN; planning-aid running header`);

  // 5. 390 px
  await p.setViewportSize({ width: 390, height: 800 }); await p.click('#tabBar [data-otab=summary]'); await p.waitForTimeout(300);
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert.ok(ov <= 1, 'page scroll ' + ov); await shot('c7-summary-390');
  await p.click('#tabBar [data-otab=dwg]'); await p.waitForTimeout(400); assert.ok(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1); await shot('c7-drawings-390');
  assert.deepEqual(errs, []);
  ok('390 px: Summary and Drawings without page-wide horizontal scroll; 0 console errors');
  console.log(`crane-drawings: ${n} checks passed`);
} catch (e) { console.error(e); console.error('console errors:', errs); process.exitCode = 1; } finally { await b.close(); }
