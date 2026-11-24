#!/usr/bin/env node
// BRG-HO (2026-11-24): PS Bridge (apps/ps-bridge/index.html) -> Elastomeric Bearing Design Module (elastomeric_design_module.html), the
// bearingLoads hand-off (HANDOFF.md §4.17). Headless Chromium, file:// (one localStorage). A made-up bridge: a new project (5 girders,
// one 120 ft span) with a 6 ft left sidewalk, PL 75 psf, a utility on the noncomposite section 0.10 klf, a future utility allowance
// 0.05 klf and a utility on the composite section 0.06 klf.
//   Sender: nothing on load; "Send bearing loads to the Elastomeric Bearing module": the channel key, .updatedAt, .by.psbridge and the
//     per-project copy hold the page's builder payload (2 bearing lines x 5 girders); the stale banner appears after an input change.
//   Receiver: nothing applied on load; the "new data" marker (a copy of this project's name); Pull: the dialog lists the project, the
//     bearing lines, every girder's values and what Apply changes; default design girder = the largest P_DL + P_LL; Apply: I-4 P_DL,
//     P_LL (without IM), P_min and the Girder Run as the hand check, S.brgSrc recorded, the worked panel and the Report subsection show
//     the source; an edited P_LL stays editable and is flagged; a later send with other values raises the stale banner; Load reopens.
//   An old project (no S.brgSrc) shows no panel and no banner. 0 console errors.
//   node tests/smoke/ps-bridge-bearing.mjs [--shots <dir>]
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const shots = (i => i > 0 ? process.argv[i + 1] : null)(process.argv.indexOf('--shots'));
const NS = 'bridgeSuite.v1.', NAME = 'Mill Road over Stony Brook', PID = '~' + NAME, t0 = Date.now();
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const near = (a, b2, t, m) => assert.ok(Math.abs(a - b2) <= t, `${m}: ${a} vs ${b2}`);
const { b, ctx, p, errs, dialogs } = await openPage(path.join(REPO, 'apps/ps-bridge/index.html'), { vw: 1400, vh: 1000, dsf: shots ? 2 : undefined });
try {
  await p.waitForFunction(() => window.PSBHandoffUI && document.querySelector('#inTabs [data-itab="proj"]'), null, { timeout: 120000 });
  await p.evaluate(name => { localStorage.clear(); const P = PSBModel.newProject(); P.project.name = name; P.xs.dl.swL = { w: 6, t: 9 }; P.xs.dl.ped = 75;
    P.xs.dl.extra = [{ name: 'Gas main', cat: 'UTN', x: 16.5, plf: 0.10 }, { name: 'Future utility', cat: 'UF', x: 16.5, plf: 0.05 }, { name: 'Water main', cat: 'UT', x: 25, plf: 0.06 }];
    localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); }, NAME);
  await p.reload(); await p.waitForFunction(() => window.PSBHandoffUI && document.querySelector('#inTabs [data-itab="proj"]') && document.getElementById('out').innerText.length > 50, null, { timeout: 120000 });
  await p.click('#inTabs [data-itab="proj"]'); await p.waitForSelector('#psbHo [data-ho="brgSend"]');
  assert.equal(await p.evaluate(ns => Object.keys(localStorage).filter(k => k.indexOf(ns + 'bearingLoads') === 0).length, NS), 0, 'nothing sent on load');
  if (shots) { await p.locator('#psbHo [data-ho="brgSend"]').scrollIntoViewIfNeeded(); await p.locator('#psbHo [data-ho="brgSend"]').evaluate(e => e.closest('.fRow').nextElementSibling.scrollIntoView()); await p.locator('#psbHo').screenshot({ path: path.join(shots, 'brg-ho-ps-sender-card.png') }); }
  await p.click('#psbHo [data-ho="brgSend"]');
  try { await p.waitForFunction(k => !!localStorage.getItem(k), NS + 'bearingLoads.by.psbridge.' + PID, { timeout: 180000 }); } catch (e) { throw new Error('not sent: ' + JSON.stringify(dialogs).slice(0, 1500)); }
  await p.waitForTimeout(300);
  const own = await p.evaluate(() => { const P = PSBModel.load(localStorage).project, A = PSBBridge.results(P, i => PSBHoldDown.compute(JSON.parse(JSON.stringify(i)))).cells; return PSBBearing.blPayload(P, A).payload; });
  const strip = o => { const c = JSON.parse(JSON.stringify(o)); ['producedAt', 'device'].forEach(k => delete c[k]); return c; };
  const st = await p.evaluate(ns => ['bearingLoads', 'bearingLoads.by.psbridge', 'bearingLoads.by.psbridge.~Mill Road over Stony Brook'].map(k => localStorage.getItem(ns + k)).concat([localStorage.getItem(ns + 'bearingLoads.updatedAt')]), NS);
  assert.ok(st[0] === st[1] && st[1] === st[2], 'the three copies are the same payload'); const bl = JSON.parse(st[0]); assert.equal(st[3], bl.producedAt);
  assert.deepEqual(strip(bl), strip(own)); assert.equal(bl.lines.length, 2); assert.equal(bl.lines[0].girders.length, 5); assert.equal(bl.producer, 'PS-Beam');
  assert.deepEqual(bl.lines[0].girders[1].separate, { PL: 4.05, PLmin: 0, UT: 1.2, UF: 0.6, UTc: 0.72 });
  assert.match(dialogs.at(-1), /^Kept for project "Mill Road over Stony Brook"/); assert.match(dialogs.at(-1), /Bearing loads sent/);
  ok(`sender: bearingLoads, its .by.psbridge and per-project copies (2 lines x 5 girders); G2 Abut. 1 DC1 ${bl.lines[0].girders[1].DC1}, LL ${bl.lines[0].girders[1].LL.max} / LL+IM ${bl.lines[0].girders[1].LL.maxIM} kip`);
  // ---- receiver ----
  const q = await ctx.newPage(); const errs2 = [], dl2 = [];
  if (shots) await q.setViewportSize({ width: 1400, height: 1000 });
  q.on('console', m => { if (m.type() === 'error') errs2.push(m.text().slice(0, 300)); }); q.on('pageerror', e => errs2.push('pageerror: ' + e.message)); q.on('dialog', async d => { dl2.push(d.message()); await d.accept(); });
  await q.goto('file://' + path.join(REPO, 'elastomeric_design_module.html'));
  await q.waitForFunction(() => typeof S === 'object' && typeof LAST !== 'undefined' && LAST && document.getElementById('edmBrgPull'));
  const s0 = await q.evaluate(() => ({ Pdl: S.loads.Pdl, Pll: S.loads.Pll, src: S.brgSrc, bar: document.getElementById('edmBrgBar').innerHTML, panel: !!document.querySelector('[data-cid="o-brg"]') }));
  assert.equal(s0.Pdl, 80); assert.equal(s0.Pll, 55); assert.equal(s0.src, undefined); assert.equal(s0.bar, ''); assert.equal(s0.panel, false);
  ok('receiver: an old project (no S.brgSrc): nothing applied on load, no banner, no panel');
  await q.evaluate(nm => { const e = document.querySelector('#inputPanel [data-path="proj.name"]'); e.value = nm; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, NAME);
  await q.waitForTimeout(400); await q.evaluate(() => edmBrgStale());
  assert.equal(await q.evaluate(() => document.getElementById('edmBrgNew').hidden), false, 'new-data marker: a copy for this project name');
  await q.click('#edmInTab_project'); await q.click('#edmBrgPull'); await q.waitForSelector('#dlgBrg [data-brg-act="apply"]');
  const dg = await q.evaluate(() => ({ proj: document.querySelector('#dlgBrg [data-brg="gi"]').selectedOptions[0].textContent, lines: [...document.querySelectorAll('#dlgBrg [data-brg="li"] option')].map(o => o.textContent),
    rows: document.querySelectorAll('#dlgBrg table.itbl')[0].querySelectorAll('tr').length, txt: document.getElementById('dlgBrg').innerText, girder: document.querySelector('#dlgBrg input[data-brg="girder"]:checked').value }));
  assert.match(dg.proj, /Mill Road over Stony Brook/); assert.equal(dg.lines.length, 2); assert.match(dg.lines[0], /Abut\. 1 \(span 1, left end\)/); assert.equal(dg.rows, 6);
  assert.match(dg.txt, /What Apply changes/); assert.match(dg.txt, /UT \(in DC1\)/); assert.match(dg.txt, /rotations θ/);
  // the default design girder: the largest P_DL + P_LL (G2 to G4 equal: the first, G2)
  const g2 = bl.lines[0].girders[1], hand = { Pdl: +(g2.DC1 + g2.DC2 + g2.DW).toFixed(3), Pll: +(g2.LL.max + 4.05).toFixed(3), Pmin: +(g2.DC1 + g2.DC2 - 1.2 - 0.6).toFixed(3) };
  assert.equal(dg.girder, 'G2');
  if (shots) await q.locator('#dlgBrg').screenshot({ path: path.join(shots, 'brg-ho-edm-pull-dialog.png') });
  await q.click('#dlgBrg [data-brg-act="apply"]'); await q.waitForTimeout(600);
  const s1 = await q.evaluate(() => ({ L: JSON.parse(JSON.stringify(S.loads)), G: JSON.parse(JSON.stringify(S.girders)), B: JSON.parse(JSON.stringify(S.brgSrc)), ad: localStorage.getItem('bridgeSuite.v1.bearingLoads.adopted.edm') }));
  near(s1.L.Pdl, hand.Pdl, 1e-9, 'P_DL = DC1 + DC2 + DW'); near(s1.L.Pll, hand.Pll, 1e-9, 'P_LL = LL + PL'); near(s1.L.Pmin, hand.Pmin, 1e-9, 'P_min = DC1 + DC2 - UT - UF');
  assert.equal(s1.G.length, 5); assert.match(s1.G[0].tag, /^G1 — Abut\. 1/); assert.equal(s1.B.girder, 'G2'); assert.equal(s1.B.pid, PID); assert.equal(s1.ad, bl.producedAt);
  assert.equal(s1.L.thetaLL, 0.004); assert.equal(s1.L.deltaS, 0.35);   // not sent: unchanged
  ok(`receiver Apply: P_DL ${s1.L.Pdl} = DC1 + DC2 + DW, P_LL ${s1.L.Pll} = LL + PL, P_min ${s1.L.Pmin} = DC1 + DC2 − UT − UF (G2, Abut. 1); Girder Run 5 girders; θ and Δs unchanged`);
  await q.evaluate(() => edmGoto('tab-gird', 'o-brg')); await q.waitForTimeout(500);
  const pn = await q.evaluate(() => document.querySelector('[data-cid="o-brg"]').innerText);
  assert.match(pn, /From PS-Beam/); assert.match(pn, /Mill Road over Stony Brook/); assert.match(pn, /Abut\. 1 \(span 1, left end\)/); assert.match(pn, /Every girder of this bearing line/);
  if (shots) await q.locator('[data-cid="o-brg"]').screenshot({ path: path.join(shots, 'brg-ho-edm-worked-panel.png') });
  const note = await q.evaluate(() => { document.getElementById('edmInTab_loads').click(); return document.querySelector('[data-cid="in-loads"]').innerText; });
  assert.match(note, /were filled from PS-Beam/); assert.match(note, /Girder Run · Bearing loads received/);
  ok('receiver: the worked panel (Girder Run tab) and the I-4 note with its link show the source');
  // the Report subsection
  const rp = await q.evaluate(() => { const m = edrModel(); return JSON.stringify(m); });
  assert.match(rp, /Bearing loads received \(hand-off\)/); assert.match(rp, /P_\{DL\}/);
  ok('receiver: the Report has the "Bearing loads received (hand-off)" subsection with the worked steps');
  // editable: a changed P_LL is kept and flagged
  await q.evaluate(() => { const e = document.querySelector('#inputPanel [data-path="loads.Pll"]'); e.value = '100'; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
  await q.waitForTimeout(500); await q.evaluate(() => edmGoto('tab-gird', 'o-brg')); await q.waitForTimeout(300);
  assert.equal(await q.evaluate(() => S.loads.Pll), 100); assert.match(await q.evaluate(() => document.querySelector('[data-cid="o-brg"]').innerText), /Edited after the hand-off: PLL is now 100/);
  ok('receiver: the applied values stay editable; an edit is flagged in the worked panel');
  assert.equal(await q.evaluate(() => document.getElementById('edmBrgBar').innerHTML), '', 'no stale banner while the copy is the one applied');
  // ---- a later send with other values: the stale banners (sender after an input change, receiver after the new send) ----
  await p.bringToFront();
  await p.evaluate(() => { const P = PSBModel.load(localStorage).project; P.xs.dl.ped = 90; localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); });
  await p.reload(); await p.waitForFunction(() => window.PSBHandoffUI && document.getElementById('out').innerText.length > 50, null, { timeout: 120000 });
  await p.waitForFunction(() => /Bearing loads \(bearingLoads\)/.test((document.getElementById('hoStaleBar') || {}).innerText || ''), null, { timeout: 180000 });
  ok('sender: the stale banner names "Bearing loads (bearingLoads)" after an input change');
  if (shots) await p.locator('#hoStaleBar').screenshot({ path: path.join(shots, 'brg-ho-ps-stale.png') });
  await p.click('#hoStaleBar [data-hos="bearingLoads"]');
  await p.waitForFunction(at => JSON.parse(localStorage.getItem('bridgeSuite.v1.bearingLoads')).producedAt !== at, bl.producedAt, { timeout: 180000 });
  await q.bringToFront(); await q.evaluate(() => edmBrgStale()); await q.waitForTimeout(300);
  const bar = await q.evaluate(() => document.getElementById('edmBrgBar').innerText);
  assert.match(bar, /Bearing loads \(bearingLoads\)/); assert.match(bar, /later hand-off/);
  if (shots) await q.locator('#edmBrgBar').screenshot({ path: path.join(shots, 'brg-ho-edm-stale.png') });
  await q.click('#edmBrgBar [data-brg-load]'); await q.waitForSelector('#dlgBrg[open] [data-brg-act="apply"]');
  const dg2 = await q.evaluate(() => ({ li: document.querySelector('#dlgBrg [data-brg="li"]').value, g: document.querySelector('#dlgBrg input[data-brg="girder"]:checked').value }));
  assert.deepEqual(dg2, { li: '0', g: 'G2' }, 'Load reopens the pull on the same bearing line and girder');
  await q.click('#dlgBrg [data-brg-act="apply"]'); await q.waitForTimeout(500);
  assert.equal(await q.evaluate(() => document.getElementById('edmBrgBar').innerHTML), '');
  ok('receiver: a later send raises the stale banner; Load = the same pull (same line and girder); after Apply no banner');
  assert.deepEqual(errs, [], 'sender console'); assert.deepEqual(errs2, [], 'receiver console');
  console.log(`ps-bridge-bearing: ${n} checks OK (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
} finally { await b.close(); }
