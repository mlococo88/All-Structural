#!/usr/bin/env node
// Crane Pick Analyzer (apps/crane-pick): the Manual output tab (2026-11-17, engineer request). Headless Chromium, file://, base map None.
// Only the SYNTHETIC fake crane (tests/smoke/crane-fake-wheeled.json) is used.
//   1. the Manual tab sits before Report; 7 parts; every link target names an existing tab (empty project);
//   2. a project with a pick, a tandem girder lift, a route, a power line, a buried utility, a plan sheet and (mocked) terrain: EVERY
//      manual link resolves: the tab opens and the card / element / Report section it names is found;
//   3. the UI labels the manual quotes as buttons are on the page;
//   4. the filter: "token" shows only topics containing it (marked), nonsense shows none with a message, Esc clears;
//   5. Print manual (window.print stubbed): only while printing body.manPrinting; the whole manual (filter cleared);
//   6. the Report appendix: off by default; ticked → "Appendix: User manual" last, no unresolved § keys, no NaN; § links resolve;
//   7. 390 px: no page-wide horizontal scroll; 0 console errors.
//   SHOTS=<dir> node tests/smoke/crane-manual.mjs
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';
import { makePlan } from './crane-fixtures.mjs';

const SHOTS = process.env.SHOTS;
const FILE = path.join(REPO, 'apps/crane-pick/index.html');
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const FW = path.join(process.env.TMPDIR || '/tmp', 'crane-fake-wheeled-man.json');
fs.copyFileSync(path.join(REPO, 'tests/smoke/crane-fake-wheeled.json'), FW);
const { b, p, errs } = await openPage(FILE, { vw: 1280, vh: 900, ls: { 'crane.ui': '{"base":"none","itab":"cranes"}' } });
const shot = async nm => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, nm + '.png') }); } };
try {
  await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(300);
  // 1. the tab, the parts, the link targets' tabs
  const tabs = await p.$$eval('#tabBar [data-otab]', x => x.map(b => b.dataset.otab));
  assert.ok(tabs.indexOf('man') >= 0 && tabs.indexOf('man') === tabs.indexOf('rpt') - 1, 'Manual just before Report: ' + tabs.join());
  assert.equal(await p.$eval('#tabBar [data-otab=man]', b => b.textContent), 'Manual');
  await p.click('#tabBar [data-otab=man]'); await p.waitForSelector('#manQ');
  const parts = await p.$$eval('.manPart > h2', h => h.map(x => x.textContent));
  assert.deepEqual(parts.map(t => t.replace(/^(\d)\..*/, '$1')), ['1', '2', '3', '4', '5', '6', '7'], parts.join(' | '));
  const links = await p.evaluate(() => CranePickManual.links());
  assert.ok(links.length > 60, 'links: ' + links.length);
  const r0 = await p.evaluate(() => CranePickManual.links().map(l => ({ t: l.target, r: CranePickManual.go(l.target) })));
  const bad0 = r0.filter(x => !x.r.ok); assert.deepEqual(bad0.map(x => x.t), [], 'tabs that do not exist');
  ok(`Manual tab before Report; 7 parts (${parts.join(' · ')}); ${links.length} links, every one names an existing tab / topic / Report key form`);

  // 2. a populated project
  await p.evaluate(() => CranePickApp.showITab('cranes'));
  await p.setInputFiles('#crFiles', [FW]); await p.waitForFunction(() => /1 crane loaded/.test(document.querySelector('#crStatus').textContent));
  await p.click('[data-ca=add]'); await p.waitForTimeout(200);
  await p.evaluate(() => { const K = CranePickCranes, M = CranePickModel, c = CranePickApp.P.cranes[0], g = K.groups(c.def).find(g => Object.values(g.configs).some(x => x.id === 'or-full-360')).key;
    CranePickApp.update(P => {
      P.setups.push(M.normSetup({ id: 'u0', name: 'Crane A', craneId: c.id, x: 500, y: 2000, heading: 0, group: g, boom: 60, pad: 100 }));
      [1000, 1100].forEach((x, i) => P.setups.push(M.normSetup({ id: 'u' + (i + 1), name: 'Crane ' + (i + 1), craneId: c.id, x, y: 2000, heading: 0, group: g, boom: 80, pad: 100 })));
      P.picks.push(M.normPick({ id: 'k1', name: 'Pick 1', setupId: 'u0', pick: { x: 500, y: 2030 }, set: { x: 500, y: 2020 }, load: 20000, rigging: 1000, hook: 1000, ded: 0, swing: 'short' }));
      P.tandems.push(M.normTandem({ id: 't1', name: 'Tandem 1', type: 'tandem', slots: ['u1', 'u2'], girder: { L: 60, W: 40000, cg: 28, H: 6 }, hooks: [{ s: 10 }, { s: 50 }], pick: { x: 1050, y: 1980, h: 90, z: 105 }, set: { x: 1050, y: 2000, h: 90, z: 120 } }));
      P.routes.push(M.normRoute({ id: 'r1', name: 'Route 1', pts: [{ x: 900, y: 1700 }, { x: 1050, y: 1700 }, { x: 1050, y: 1990 }], rad: [null, 80, null], tandemId: 't1' }));
      P.items.push(M.normItem({ type: 'power', name: 'OH 115 kV', kv: 115, pts: [{ x: 470, y: 2050 }, { x: 560, y: 2045 }] }));
      P.items.push(M.normItem({ type: 'util', name: 'Water main', kind: 'utility', depth: 4, pts: [{ x: 480, y: 1990 }, { x: 530, y: 1990 }] }));
      // terrain as fetched (the grid itself is not needed for the Report's §Terrain basis; the smoke crane-terrain.mjs tests the fetch)
      P.terrain = M.normTerrain({ use: false, src: { id: 'mock', at: '2026-11-17T00:00:00Z', svc: 'mock getSamples', x0: 400, y0: 1900, dx: 5, nx: 3, ny: 3, n: 9, nodata: 0, zone: P.site.zone } });
    }, 'setups'); });
  const PL = path.join(process.env.TMPDIR || '/tmp', 'crane-manual-plan.png'); await makePlan(p, PL);
  await p.evaluate(() => CranePickApp.showITab('sheets')); await p.setInputFiles('#shFile', [PL]); await p.waitForTimeout(1000);
  await p.evaluate(() => CranePickApp.showOTab('man'));
  const r1 = await p.evaluate(() => CranePickManual.links().map(l => ({ t: l.target, r: CranePickManual.go(l.target) })));
  const bad1 = r1.filter(x => !x.r.ok || !x.r.found);
  assert.deepEqual([...new Set(bad1.map(x => x.t))], [], 'links whose card / Report section is not found');
  const kinds = r1.reduce((a, x) => { a[x.r.kind] = (a[x.r.kind] || 0) + 1; return a; }, {});
  // spot checks: the tab really opens and the card is the one named
  const sc = await p.evaluate(() => { const o = {}; CranePickManual.go('in:sheets>Images in this browser'); o.it = CranePickApp.ui.itab; const fl = document.querySelector('#inPanes [data-pane=sheets] .manFlash'); o.card = fl ? fl.textContent.slice(0, 40) : '';
    CranePickManual.go('out:picks>Girder lifts'); o.ot = CranePickApp.ui.otab; CranePickManual.go('in:cranes#crSrc'); o.src = document.getElementById('crSrc').open; return o; });
  assert.equal(sc.it, 'sheets'); assert.match(sc.card, /Images in this browser/i); assert.equal(sc.ot, 'picks'); assert.equal(sc.src, true);
  await p.evaluate(() => CranePickManual.go('rpt:lift-rule')); await p.waitForTimeout(500);
  assert.equal(await p.evaluate(() => CranePickApp.ui.otab), 'rpt');
  assert.ok(await p.evaluate(() => { const v = CranePickReportUI.view, e = v.doc.index.get('lift-rule'), x = document.getElementById(e.anchor), r = x.getBoundingClientRect(); return r.top > -5 && r.top < 400; }), 'Report scrolled to §Lifts › Basis');
  ok(`populated project: all ${r1.length} links resolve (${Object.entries(kinds).map(([k, v]) => k + ' ' + v).join(', ')}); spot checks: card flashed, details opened, Report jumped to §Lifts › Basis`);

  // 3. button labels the manual quotes exist on the page (all tabs built)
  const labels = ['Save as…', 'Saved projects…', 'New', 'Export JSON', 'Add plan sheet…', 'Align to map…', 'Pick two points…', 'Replace image…', 'Clean up unused images…',
    'Load crane library from GitHub', 'Load crane file(s)…', 'New crane (paste a chart)…', 'Defaults', 'Place on the map', 'Edit…', 'Place at the map centre', 'Add a pick',
    'New tandem lift', 'New one-crane girder lift', 'Place for crane 1', 'Place for crane 2', 'Add a waypoint', 'Play', 'Route', 'Overhead clearance (point)', 'Overhead clearance (line)',
    'Haul road / mats', 'Posted bridge', 'Move the girder lift\'s pick pose to the girder on the truck', 'Fetch terrain for this site', 'Download DXF', 'Print sheet', 'Print all sheets', 'Print report', 'Print manual'];
  const found = await p.evaluate(async L => {
    const sel = n => { const b = [...document.querySelectorAll('#inPanes [data-pane=lifts] button, #inPanes [data-pane=tandem] button, #inPanes [data-pane=route] button')].find(x => x.textContent.trim() === n); if (b) b.click(); };
    CranePickApp.showITab('lifts'); sel('Crane A'); CranePickApp.showITab('tandem'); sel('Tandem 1'); CranePickApp.showITab('route'); sel('Route 1');
    ['proj', 'sheets', 'cranes'].forEach(t => CranePickApp.showITab(t)); ['dwg', 'rpt', 'man'].forEach(t => CranePickApp.showOTab(t));
    const all = [...document.querySelectorAll('button')].map(x => x.textContent.replace(/\s+/g, ' ').trim());
    return L.filter(l => !all.some(t => t === l || t.startsWith(l)));
  }, labels);
  assert.deepEqual(found, [], 'button labels quoted by the manual and not on the page');
  const txt = await p.evaluate(() => CranePickManual.text());
  assert.deepEqual(labels.filter(l => !txt.includes(l)), [], 'labels listed here but not quoted in the manual');
  ok(`${labels.length} button labels the manual quotes are on the page`);

  // 4. filter
  await p.evaluate(() => CranePickApp.showOTab('man'));
  const all = await p.$$eval('.manTopic', t => t.length);
  await p.fill('#manQ', 'token'); await p.waitForTimeout(100);
  const f1 = await p.evaluate(() => ({ shown: [...document.querySelectorAll('.manTopic')].filter(t => !t.hidden).map(t => ({ id: t.dataset.topic, hit: t.textContent.toLowerCase().includes('token'), marks: t.querySelectorAll('mark.manHit').length })), count: document.getElementById('manCount').textContent,
    hiddenParts: [...document.querySelectorAll('.manPart')].filter(s => s.hidden).length }));
  assert.ok(f1.shown.length > 1 && f1.shown.length < all, JSON.stringify(f1));
  assert.ok(f1.shown.every(t => t.hit && t.marks > 0)); assert.ok(f1.shown.some(t => t.id === 'tr-notfound')); assert.equal(f1.count, `${f1.shown.length} of ${all} topics`); assert.ok(f1.hiddenParts > 0);
  await shot('manual-filter');
  await p.fill('#manQ', 'fine-grained repo'); await p.waitForTimeout(80);
  assert.deepEqual(await p.$$eval('.manTopic:not([hidden])', t => t.map(x => x.dataset.topic)), ['tr-notfound']);
  await p.fill('#manQ', 'zzqxv'); await p.waitForTimeout(80);
  assert.equal(await p.$$eval('.manTopic:not([hidden])', t => t.length), 0); assert.match(await p.textContent('#manCount'), /No topic contains "zzqxv"/);
  await p.focus('#manQ'); await p.keyboard.press('Escape'); await p.waitForTimeout(80);
  assert.equal(await p.$$eval('.manTopic:not([hidden])', t => t.length), all); assert.equal(await p.$$eval('mark.manHit', m => m.length), 0);
  // a manual link (man:) clears the filter and scrolls to its topic
  await p.fill('#manQ', 'scrubber'); await p.waitForTimeout(80);
  const ml = await p.evaluate(() => CranePickManual.go('man:tr-notfound')); assert.ok(ml.found); assert.equal(await p.inputValue('#manQ'), '');
  ok(`filter: "token" → ${f1.shown.length} of ${all} topics (marked), "fine-grained repo" → the GitHub "Not found" topic only, nonsense → none (message), Esc clears; a man: link clears it`);

  // 5. print
  const pr = await p.evaluate(() => { let during = null; const p0 = window.print; window.print = () => { during = { cls: document.body.classList.contains('manPrinting'), shown: [...document.querySelectorAll('.manTopic')].filter(t => !t.hidden).length }; };
    document.getElementById('manQ').value = 'mats'; CranePickManual.filter('mats'); document.getElementById('manPrint').click(); window.dispatchEvent(new Event('afterprint')); window.print = p0;
    return { during, after: document.body.classList.contains('manPrinting'), q: document.getElementById('manQ').value, shownAfter: [...document.querySelectorAll('.manTopic')].filter(t => !t.hidden).length }; });
  assert.deepEqual([pr.during.cls, pr.during.shown, pr.after, pr.q], [true, all, false, 'mats']); assert.ok(pr.shownAfter < all);
  await p.evaluate(() => { document.getElementById('manQ').value = ''; CranePickManual.filter(''); });
  ok('Print manual: the whole manual (filter cleared while printing, restored after), body.manPrinting only during printing');

  // 6. Report appendix
  const ra = await p.evaluate(() => { const has = () => CranePickReport.model(CranePickApp.P).sections.some(s => s.id === 'manual'); const off = has();
    document.getElementById('manRpt').click(); const on = has(); return { off, on, ui: CranePickApp.ui.manRpt }; });
  assert.deepEqual(ra, { off: false, on: true, ui: true });
  await p.click('#tabBar [data-otab=rpt]'); await p.waitForTimeout(500);
  const rp = await p.evaluate(() => { const v = CranePickReportUI.view, secs = v.doc.model.sections; const txt = SharedReport.text(v.doc);
    return { last: secs[secs.length - 1].title, unresolved: v.doc.unresolved, dup: v.doc.dup, nan: /NaN|undefined/.test(txt), see: (txt.match(/§\d+(\.\d+)?/g) || []).length, man: /Quick start: a lift in ten steps/.test(txt), tab: !!document.querySelector('.rp-go[data-rpgoto="in:sheets"]') }; });
  assert.equal(rp.last, 'Appendix: User manual'); assert.deepEqual(rp.unresolved, []); assert.deepEqual(rp.dup, []); assert.equal(rp.nan, false); assert.ok(rp.man && rp.tab);
  await p.evaluate(() => CranePickReportUI.view.jump('manual')); await p.waitForTimeout(200); await shot('manual-report');
  await p.click('.rp-go[data-rpgoto="in:sheets"]'); await p.waitForTimeout(150); assert.equal(await p.evaluate(() => CranePickApp.ui.itab), 'sheets');
  // with an empty project the appendix keeps no link to a missing section
  const em = await p.evaluate(() => { const M = CranePickModel, doc = SharedReport.build(CranePickReport.model(M.newProject())); return { u: doc.unresolved, last: doc.model.sections[doc.model.sections.length - 1].id }; });
  assert.deepEqual(em, { u: [], last: 'manual' });
  await p.evaluate(() => { CranePickApp.showOTab('man'); document.getElementById('manRpt').click(); });
  assert.equal(await p.evaluate(() => CranePickReport.model(CranePickApp.P).sections.some(s => s.id === 'manual')), false);
  ok('Report appendix: off by default; ticked → last section "Appendix: User manual", no unresolved / duplicate keys, no NaN, its tab links open the input tab; empty project: no dangling § link');

  await p.waitForTimeout(1100); assert.equal(await p.inputValue('#manQ'), '', 'the print fallback timer does not restore an old filter');
  await p.evaluate(() => document.querySelectorAll('#notices .notice').forEach(x => x.remove()));
  await p.evaluate(() => { CranePickApp.showOTab('man'); document.getElementById('man-start').scrollIntoView(); }); await p.waitForTimeout(100); await shot('manual-1280');
  await p.evaluate(() => document.getElementById('man-meth').scrollIntoView()); await p.waitForTimeout(100); await shot('manual-methods');
  // 7. 390 px
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
  await p.evaluate(() => { CranePickApp.showOTab('man'); window.scrollTo(0, 0); }); await p.waitForTimeout(200);
  const w = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth, wide: [...document.querySelectorAll('[data-opane=man] *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1 && !e.closest('.manTblW')).map(e => e.tagName + '.' + e.className).slice(0, 5) }));
  assert.ok(w.sw <= w.vw + 1, JSON.stringify(w)); assert.deepEqual(w.wide, []);
  await p.evaluate(() => document.querySelector('[data-opane=man]').scrollIntoView()); await shot('manual-390');
  const g390 = await p.evaluate(() => CranePickManual.go('in:ground>Ground and supports')); assert.ok(g390.found);
  await p.waitForTimeout(200); assert.ok(await p.evaluate(() => { const r = document.querySelector('.manFlash').getBoundingClientRect(); return r.top < window.innerHeight && r.bottom > 0; }), 'the card is on screen at 390 px');
  ok('390 px: no page-wide horizontal scroll (tables scroll in their box); a link brings the input card below the map into view');
  const E = errs.filter(e => !/Failed to load resource/.test(e));
  assert.deepEqual(E, [], 'console errors'); ok('0 console errors');
  console.log(`\n${n} checks passed`);
} finally { await b.close(); }
