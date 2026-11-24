#!/usr/bin/env node
// BRG-HO PR 2 (2026-11-24): Steel Bridge Design (apps/steel-bridge/index.html) -> Elastomeric Bearing Design Module, bearingLoads (HANDOFF.md
// §4.17). Headless Chromium, file://. The default steel bridge (3 continuous spans) named "Elm Street (made up)" with a 6 ft left sidewalk,
// PL 75 psf, a utility (UT 0.3 klf) and a future allowance (UF 0.25 klf).
//   Sender: nothing on load; "Send bearing loads to the Elastomeric Bearing module": the channel key, .updatedAt, .by.steelbridge and the
//     per-project copy hold blPayload (one line per support, LL with IM only); an input change raises the stale banner "Bearing loads".
//   Receiver: Pull: the dialog says LL+IM is used (no LL without IM sent) and selects it; Pier 1; Apply: P_DL = DC1 + DC2 + DW, P_LL =
//     LL+IM + PL, P_min = DC1 + DC2 − UT − UF of the default girder; the worked panel names Steel Bridge Design. 0 console errors.
//   node tests/smoke/steel-bridge-bearing.mjs [--shots <dir>]
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const shots = (i => i > 0 ? process.argv[i + 1] : null)(process.argv.indexOf('--shots'));
const NS = 'bridgeSuite.v1.', NAME = 'Elm Street (made up)', PID = '~Elm Street %28made up%29', t0 = Date.now();
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const near = (a, b2, t, m) => assert.ok(Math.abs(a - b2) <= t, `${m}: ${a} vs ${b2}`);
const { b, ctx, p, errs, dialogs } = await openPage(path.join(REPO, 'apps/steel-bridge/index.html'), { vw: 1400, vh: 1000, dsf: shots ? 2 : undefined });
try {
  const ready = () => p.waitForFunction(() => window.SBDHandoffUI && document.querySelector('#inTabs [data-itab="proj"]') && document.getElementById('out').innerText.length > 20, null, { timeout: 120000 });
  await ready();
  await p.evaluate(name => { localStorage.clear(); const P = SBDModel.defaultProject(); P.project.name = name; P.xs.sidewalks.L = { w: 6, t: 8, fence: null, fenceX: null }; P.xs.sidewalks.ped = 75;
    P.xs.extra = [{ name: 'Utility A', cat: 'UT', x: 17.5, plf: 0.3, dist: 'two' }, { name: 'Future', cat: 'UF', x: 27, plf: 0.25, dist: 'auto' }];
    localStorage.setItem('sbd2.project.current', SBDModel.exportJSON(P)); }, NAME);
  await p.reload(); await ready();
  await p.evaluate(() => document.querySelector('#inTabs [data-itab="proj"]').click()); await p.waitForSelector('#sbdHo [data-ho="brgSend"]');
  assert.equal(await p.evaluate(ns => Object.keys(localStorage).filter(k => k.indexOf(ns + 'bearingLoads') === 0).length, NS), 0, 'nothing sent on load');
  if (shots) { await p.locator('#sbdHo [data-ho="brgSend"]').scrollIntoViewIfNeeded(); await p.locator('#sbdHo [data-ho="brgSend"]').evaluate(e => e.closest('.hoRow').scrollIntoView()); await p.locator('#sbdHo [data-ho="brgSend"]').evaluate(e => e.closest('.hoRow')).then(() => p.locator('.hoRow', { has: p.locator('[data-ho="brgSend"]') }).screenshot({ path: path.join(shots, 'brg-ho-steel-sender-row.png') })); }
  await p.click('#sbdHo [data-ho="brgSend"]');
  try { await p.waitForFunction(k => !!localStorage.getItem(k), NS + 'bearingLoads.by.steelbridge.' + PID, { timeout: 300000 }); } catch (e) { throw new Error('not sent: ' + JSON.stringify(dialogs).slice(0, 1500) + ' keys ' + (await p.evaluate(() => Object.keys(localStorage).join(', ')))); }
  await p.waitForTimeout(500);
  const st = await p.evaluate(([ns, pid]) => ['bearingLoads', 'bearingLoads.by.steelbridge', 'bearingLoads.by.steelbridge.' + pid].map(k => localStorage.getItem(ns + k)).concat([localStorage.getItem(ns + 'bearingLoads.updatedAt')]), [NS, PID]);
  assert.ok(st[0] === st[1] && st[1] === st[2], 'the three copies are the same'); const bl = JSON.parse(st[0]); assert.equal(st[3], bl.producedAt);
  assert.equal(bl.producer, 'Steel Bridge Design'); assert.equal(bl.lines.length, 4); assert.deepEqual(bl.lines.map(l => l.support), ['Abut. 1', 'Pier 1', 'Pier 2', 'Abut. 2']);
  const g = bl.lines[1].girders[1]; assert.equal(g.LL.max, null); assert.ok(g.LL.maxIM > 0); assert.ok(g.separate.PL > 0);
  assert.match(dialogs.at(-1), /^Kept for project "Elm Street \(made up\)"/);
  ok(`sender: bearingLoads (4 support lines x 5 girders), Pier 1 G2 DC1 ${g.DC1}, LL+IM ${g.LL.maxIM}, PL ${g.separate.PL} kip; the three copies`);
  // ---- receiver ----
  const q = await ctx.newPage(); const errs2 = [];
  q.on('console', m => { if (m.type() === 'error') errs2.push(m.text().slice(0, 300)); }); q.on('pageerror', e => errs2.push('pageerror: ' + e.message)); q.on('dialog', async d => { await d.accept(); });
  await q.goto('file://' + path.join(REPO, 'elastomeric_design_module.html'));
  await q.waitForFunction(() => typeof S === 'object' && typeof LAST !== 'undefined' && LAST && document.getElementById('edmBrgPull'));
  await q.click('#edmInTab_project'); await q.click('#edmBrgPull'); await q.waitForSelector('#dlgBrg [data-brg="gi"]');
  await q.selectOption('#dlgBrg [data-brg="gi"]', { index: 1 }); await q.waitForSelector('#dlgBrg [data-brg-act="apply"]');
  await q.selectOption('#dlgBrg [data-brg="li"]', '1'); await q.waitForTimeout(200);
  const dg = await q.evaluate(() => ({ im: document.querySelector('#dlgBrg [data-brg="im"]').value, txt: document.getElementById('dlgBrg').innerText, girder: document.querySelector('#dlgBrg input[data-brg="girder"]:checked').value }));
  assert.equal(dg.im, '1'); assert.match(dg.txt, /sent the live load with IM only/);
  if (shots) await q.locator('#dlgBrg').screenshot({ path: path.join(shots, 'brg-ho-edm-steel-dialog.png') });
  await q.click('#dlgBrg [data-brg-act="apply"]'); await q.waitForTimeout(600);
  const d = bl.lines[1].girders.find(x => x.label === dg.girder), s1 = await q.evaluate(() => JSON.parse(JSON.stringify({ L: S.loads, B: S.brgSrc })));
  near(s1.L.Pdl, d.DC1 + d.DC2 + d.DW, 2e-3, 'P_DL'); near(s1.L.Pll, d.LL.maxIM + d.separate.PL, 2e-3, 'P_LL = LL+IM + PL'); near(s1.L.Pmin, d.DC1 + d.DC2 - (d.separate.UT || 0) - (d.separate.UF || 0), 2e-3, 'P_min');
  assert.equal(s1.B.producer, 'Steel Bridge Design'); assert.equal(s1.B.opts.im, true); assert.equal(s1.B.lineName, 'Pier 1');
  await q.evaluate(() => edmGoto('tab-gird', 'o-brg')); await q.waitForTimeout(400);
  assert.match(await q.evaluate(() => document.querySelector('[data-cid="o-brg"]').innerText), /From Steel Bridge Design/);
  if (shots) await q.locator('[data-cid="o-brg"]').screenshot({ path: path.join(shots, 'brg-ho-edm-steel-worked.png') });
  ok(`receiver: LL+IM selected (no LL without IM sent); Pier 1 ${dg.girder}: P_DL ${s1.L.Pdl}, P_LL ${s1.L.Pll}, P_min ${s1.L.Pmin} kip as the hand sums; the worked panel names the source`);
  // ---- stale banner on the sender after an input change ----
  await p.bringToFront();
  await p.evaluate(() => { const t = localStorage.getItem('sbd2.project.current'), o = JSON.parse(t); o.xs.sidewalks.ped = 90; localStorage.setItem('sbd2.project.current', JSON.stringify(o)); });
  await p.reload(); await ready(); await p.waitForTimeout(800);
  await p.waitForFunction(() => { const e = document.getElementById('sbdHoBar'); return e && !e.hidden && /Bearing loads \(bearingLoads\)/.test(e.innerText); }, null, { timeout: 60000 });
  ok('sender: after an input change (pedestrian load 90 psf) the stale banner names "Bearing loads (bearingLoads)"');
  assert.deepEqual(errs, [], 'sender console'); assert.deepEqual(errs2, [], 'receiver console');
  console.log(`steel-bridge-bearing: ${n} checks OK (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
} finally { await b.close(); }
