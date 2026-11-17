#!/usr/bin/env node
// Crane Pick Analyzer (apps/crane-pick), C9: the Crane output tab. Headless Chromium, file://, base map None. Only the SYNTHETIC fake crane
// (tests/smoke/crane-fake-wheeled.json) is used, with the C4 hand-check weights of case A (made-up values).
//   1. a project: crane A with a single pick (boom 60, pick 30 ft over the front: C 39,000 lb, 56.4 %), two setups of a tandem girder lift (the
//      C5 hand case: 88.9 % / 74.1 %);
//   2. the tab order (Plan · Summary · Crane · Picks …); the single-pick crane: the figures' labels = the engine values (R 30.00, tip el.,
//      hook reach margin, the operating points), the assumed values amber (head allowance, boom width), the input table with sources;
//   3. the picker switches to a tandem crane: one operating point per step, the governing step = 88.9 %; the point selector;
//   4. a pick dragged (live, the tab shown): the figures and the point line follow mid-drag; one undo step after the drag ends;
//   5. Report §Cranes has the figures; Drawings has a Crane sheet per setup;
//   6. 390 px: no page-wide horizontal scroll; 0 console errors.
//   SHOTS=<dir> node tests/smoke/crane-cranetab.mjs
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
const FW = path.join(process.env.TMPDIR || '/tmp', 'crane-fake-wheeled-ph4-c9.json'); fs.writeFileSync(FW, JSON.stringify(raw));
const { b, p, errs } = await openPage(FILE, { vw: 1280, vh: 900, ls: { 'crane.ui': '{"base":"none","itab":"cranes"}' } });
const shot = async nm => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, nm + '.png'), fullPage: false }); } };
const labels = sel => p.$$eval(sel + ' [data-v]', a => a.map(x => ({ v: x.dataset.v, val: x.dataset.val, src: x.dataset.src || '', a: !!x.dataset.assumed, t: x.textContent })));
try {
  await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(300);
  await p.setInputFiles('#crFiles', [FW]); await p.waitForFunction(() => /1 crane loaded/.test(document.querySelector('#crStatus').textContent));
  await p.click('[data-ca=add]'); await p.waitForTimeout(200);
  await p.evaluate(() => { const K = CranePickCranes, M = CranePickModel, c = CranePickApp.P.cranes[0], g = K.groups(c.def).find(g => Object.values(g.configs).some(x => x.id === 'or-full-360')).key;
    CranePickApp.update(P => {
      P.setups.push(M.normSetup({ id: 'u0', name: 'Crane A', craneId: c.id, x: 500, y: 2000, heading: 0, group: g, boom: 60, pad: 100, ground: { mat: { type: 'timber', B: 4, L: 4, t: 12, Fb: 1200, Fv: 150, E: 1.2e6 }, qa: 4000 } }));
      [1000, 1100].forEach((x, i) => P.setups.push(M.normSetup({ id: 'u' + (i + 1), name: 'Crane ' + (i + 1), craneId: c.id, x, y: 2000, heading: 0, group: g, boom: 80, pad: 100 })));
      P.picks.push(M.normPick({ id: 'k1', name: 'Pick 1', setupId: 'u0', pick: { x: 500, y: 2030 }, set: { x: 500, y: 2020 }, load: 20000, rigging: 1000, hook: 1000, ded: 0, swing: 'short' }));
      P.tandems.push(M.normTandem({ id: 't1', name: 'Tandem 1', type: 'tandem', slots: ['u1', 'u2'], girder: { L: 60, W: 40000, cg: 28, H: 6 },
        hooks: [{ s: 10, rig: 1000, hook: 1000, rigH: 10, blk: 4 }, { s: 50, rig: 1000, hook: 1000, rigH: 10, blk: 4 }], pick: { x: 1050, y: 1980, h: 90, z: 105 }, set: { x: 1050, y: 2000, h: 90, z: 120 } }));
    }, 'setups'); });
  ok('a project: crane A with a single pick, cranes 1 and 2 on a tandem girder lift (synthetic fake crane)');

  // 2. the tab and the single-pick crane
  assert.deepEqual(await p.$$eval('#tabBar [data-otab]', a => a.map(x => x.textContent)), ['Plan', 'Summary', 'Crane', 'Picks', 'Ground', 'Route', 'Terrain', 'Site', 'Drawings', 'Manual', 'Report']);
  await p.click('#tabBar [data-otab=crane]'); await p.waitForSelector('#crnPlan svg');
  assert.equal(await p.$$eval('#crnSel option', o => o.length), 3);
  await p.selectOption('#crnAt', 'pick'); await p.waitForTimeout(100);
  const eng = await p.evaluate(() => { const ev = CranePickPlace.evalPick(CranePickApp.P.picks[0]); return { R: ev.pick.R, tip: ev.elev.pick.zTip, m: ev.elev.pick.margin, pct: ev.pick.pct, W: ev.W, fl: ev.ground.max[0].load }; });
  const E = await labels('#crnElev'), byV = (L, v) => L.find(x => x.v === v);
  near(+byV(E, 'pt.R').val, eng.R, 1e-9, 'R'); near(+byV(E, 'pt.zTip').val, eng.tip, 1e-9, 'tip'); near(+byV(E, 'pt.m').val, eng.m, 1e-9, 'margin'); near(+byV(E, 'pt.W').val, 22000, 0);
  assert.match(byV(E, 'pt.zTip').t, /tip el\. 160\.48/); assert.match(byV(E, 'footH').t, /h_f 8\.00 ft \[file p\.1\]/); assert.ok(byV(E, 'head').a, 'head allowance assumed: amber');
  const Pl = await labels('#crnPlan'); assert.match(byV(Pl, 'spread').t, /spread \(full\) 24\.00 ft \[file p\.1\]/); assert.match(byV(Pl, 'tail').t, /15\.00 ft \[file p\.1\]/);
  const C = await labels('#crnChart'); const op = C.find(x => x.v === 'op.pick:k1.P'); near(+op.val, eng.pct, 1e-9, '% of chart'); assert.match(C.find(x => x.v === 'oplbl.pick:k1.P').t, /R 30\.00 ft, W 22,000 lb, 56\.4 % of chart/);
  assert.equal(C.filter(x => /^cell\./.test(x.v)).length, 23, 'every tabulated (rated) cell of the 360° chart is a marker');
  assert.match(await p.$eval('#crnChartNote', e => e.textContent), /85 % of tipping[\s\S]*FAKECO test chart TC-1[\s\S]*PRELIMINARY/);
  const Wt = await labels('#crnWts'); near(+byV(Wt, 'max.FL').val, eng.fl, 1e-6, 'front float');
  const T = await p.$$eval('#crnTbl tbody tr', r => r.map(x => ({ v: x.dataset.v, a: x.classList.contains('crnRowA'), c: [...x.cells].map(c => c.innerText.trim()) })));
  const tr = v => T.find(x => x.v === v); assert.deepEqual(tr('tail').c.slice(2, 4).map(c => c.split('\n')[0]), ['15.00 ft', 'file p.1']); assert.ok(tr('head').a && /ASSUMED/.test(tr('head').c[3])); assert.ok(tr('fb').a);
  assert.deepEqual(tr('Wcw').c.slice(2, 4).map(c => c.split('\n')[0]), ['20,000 lb', 'chart p.1']); assert.match(tr('boom').c[5], /worked: Pick 1/);
  await shot('cranetab-pick-1280');
  await p.click('#crnTbl tr[data-v=tail] [data-cg=pick]'); await p.waitForTimeout(150); assert.equal(await p.evaluate(() => CranePickApp.ui.otab), 'picks'); assert.ok(await p.$eval('#pk-k1', d => d.open));
  await p.click('#tabBar [data-otab=crane]'); await p.waitForSelector('#crnPlan svg');
  ok(`single-pick crane: elevation R ${eng.R.toFixed(2)} ft, tip el. ${eng.tip.toFixed(2)}, margin ${eng.m.toFixed(2)} ft, chart point ${eng.pct.toFixed(1)} %, front float ${eng.fl.toFixed(0)} lb = the engine; sources (file p.1, chart p.1), assumed values amber; the table and its "worked" link`);

  // 3. the tandem crane
  await p.selectOption('#crnSel', { index: 1 }); await p.waitForTimeout(150);
  const te = await p.evaluate(() => { const r = CranePickTandemUI.evalT(CranePickApp.P.tandems[0]); return { n: r.steps.length, gi: r.gov[0].i, pct: r.gov[0].c.pct, R: r.gov[0].c.R }; });
  const C2 = await labels('#crnChart'); assert.equal(C2.filter(x => /^op\.tandem:t1:0\./.test(x.v)).length, te.n, 'one point per step');
  near(+C2.find(x => x.v === `op.tandem:t1:0.${te.gi}`).val, te.pct, 1e-9); near(te.pct, 88.889, 1e-3);
  assert.match(await p.$eval('#crnChart', e => e.textContent), /tandem limit 75 %/);
  near(+byV(await labels('#crnElev'), 'pt.R').val, te.R, 1e-9, 'governing step R');
  await p.selectOption('#crnAt', 'set'); await p.waitForTimeout(100); assert.match(await p.$eval('#crnPtLine', e => e.textContent), /step \d+/);
  await shot('cranetab-tandem-1280');
  ok(`picker: tandem crane 1: ${te.n} operating points (one per step), governing step ${te.gi} ${te.pct.toFixed(1)} %, the tandem limit curve; point selector (last step)`);

  // 4. a live drag of the pick (the tab shown): the values follow mid-drag; one undo step at the end
  await p.selectOption('#crnSel', { index: 0 }); await p.selectOption('#crnAt', 'pick'); await p.waitForTimeout(100);
  const und0 = await p.evaluate(() => CranePickApp.history && CranePickApp.history.canUndo ? CranePickApp.history.canUndo() : null);
  await p.evaluate(() => { const k = CranePickApp.P.picks[0]; k.pick = { x: 500, y: 2040 }; CranePickApp.live('lifts', { id: k.id }); });
  await p.waitForFunction(() => /R = 40\.00 ft/.test((document.getElementById('crnPtLine') || {}).textContent || ''), null, { timeout: 3000 });
  const E2 = await labels('#crnElev'); near(+byV(E2, 'pt.R').val, 40, 1e-9); assert.match(await p.$eval('#crnPtLine', e => e.textContent), /C = 28,000 lb, 78\.6 % of chart/);
  await p.evaluate(() => CranePickApp.update(null, 'lifts', { id: 'k1' })); await p.waitForTimeout(100);
  assert.match(await p.$eval('#crnPtLine', e => e.textContent), /R = 40\.00 ft/);
  await p.click('#bUndo'); await p.waitForTimeout(200); assert.match(await p.$eval('#crnPtLine', e => e.textContent), /R = 30\.00 ft/); void und0;
  ok('pick moved live with the Crane tab shown: R 30 → 40 ft, C 28,000 lb (L_tab 60, R_tab 40), 78.6 % mid-drag; committed as one undo step (Undo → 30 ft)');

  // 5. Report and Drawings
  const rp = await p.evaluate(() => { const m = CranePickReport.model(CranePickApp.P), d = SharedReport.build(m), s = m.sections.find(x => x.id === 'cranes');
    return { figs: s.subs[0].items.filter(i => i.type === 'figure').map(i => i.caption), un: d.unresolved, text: SharedReport.text(d), svg: s.subs[0].items.filter(i => i.type === 'figure').map(i => i.svg).join('') }; });
  assert.ok(rp.figs.length >= 9, 'figures of 3 setups: ' + rp.figs.length); assert.deepEqual(rp.un, []); assert.ok(!/NaN|undefined/.test(rp.text));
  assert.match(rp.figs[0], /Figure \d+\. Crane A: plan/); assert.match(rp.svg, /data-v="pt.zTip"/);
  await p.click('#tabBar [data-otab=dwg]'); await p.waitForSelector('#dwgIdx');
  const ids = await p.$$eval('#dwg_sheet option', o => o.map(x => x.value)); assert.ok(['crane-u0', 'crane-u1', 'crane-u2'].every(i => ids.includes(i)), ids.join());
  await p.selectOption('#dwg_sheet', 'crane-u0'); await p.waitForTimeout(200);
  const st = await p.$eval('.dwg-box svg', s => s.textContent); assert.match(st, /TIP EL\. 160\.48/); assert.match(st, /CRANE INPUTS USED IN THE ANALYSIS/); assert.match(st, /LOAD CHART/);
  await shot('cranetab-drawing-1280');
  await p.click('#tabBar [data-otab=rpt]'); await p.waitForTimeout(400); await p.evaluate(() => { const v = CranePickReportUI.view; if (v && v.jump) v.jump('crane-' + CranePickApp.P.cranes[0].id); }); await p.waitForTimeout(400); await shot('cranetab-report-1280');
  ok(`Report §Cranes: ${rp.figs.length} figures (plan, elevation, chart, weights per setup) + input tables, no unresolved key / NaN; Drawings: Crane sheets crane-u0 / u1 / u2 (tip el., chart, input table)`);

  // 6. 390 px
  await p.setViewportSize({ width: 390, height: 800 }); await p.click('#tabBar [data-otab=crane]'); await p.waitForTimeout(300);
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert.ok(ov <= 1, 'page scroll ' + ov);
  await p.evaluate(() => document.getElementById('crnPlan').scrollIntoView()); await shot('cranetab-390');
  assert.deepEqual(errs, []);
  ok('390 px: no page-wide horizontal scroll; 0 console errors');
  console.log(`crane-cranetab: ${n} checks passed`);
} catch (e) { console.error(e); console.error('console errors:', errs); process.exitCode = 1; } finally { await b.close(); }
