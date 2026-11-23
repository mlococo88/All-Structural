#!/usr/bin/env node
// SRP (2026-11-23): PS Bridge (apps/ps-bridge/index.html) -> Bridge Substructure Loading with the pedestrian and utility reactions as
// separate optional items of superReactions (HANDOFF.md §4.4 "Separate items"). Headless Chromium, file:// (one localStorage). A made-up
// bridge: a new project (5 girders at 9 ft, one 120 ft span) with a 6 ft left sidewalk, PL 75 psf, a utility on the noncomposite section
// 0.10 klf, a future utility allowance 0.05 klf and a utility on the composite section 0.06 klf.
//   Sender: "Send to Substructure Loading": the stored payload = the page's builder, every girder with separate { PL 4.05, PLmin 0, UT 1.2,
//     UF 0.6, UTc 0.72 } and the totals DC1 / DW still containing the utilities; the message lists the separate items; the one-line send too.
//   Receiver: Pull reactions: the dialog explains the separate items and shows the UT, UF, UTc and PL columns; Apply: DC1 net of UT + UF,
//     UT and UF as their own values (dc1 + ut + uf = the DC1 sent: no double count), DW as sent; the support totals DC + DW = the payload's
//     DC1 + DC2 + DW; UF is its own permanent load in the dead load result; PL is recorded and shown as information only, and with no
//     sidewalk entered in the receiver a "Check" says no pedestrian load is in the analysis; with a sidewalk entered it goes away.
//     The old payload path (no separate items) is tests/smoke/ps-bridge-subloads.mjs, unchanged. 0 console errors.
//   node tests/smoke/ps-bridge-subloads-sep.mjs [--shots <dir>]
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const shots = (i => i > 0 ? process.argv[i + 1] : null)(process.argv.indexOf('--shots'));
const NS = 'bridgeSuite.v1.', NAME = 'Mill Road over Stony Brook', PID = '~' + NAME, t0 = Date.now();
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const near = (a, b2, t, m) => assert.ok(Math.abs(a - b2) <= t, `${m}: ${a} vs ${b2}`);
const { b, ctx, p, errs, dialogs } = await openPage(path.join(REPO, 'apps/ps-bridge/index.html'), { vw: 1400, vh: 1000 });
try {
  await p.waitForFunction(() => window.PSBHandoffUI && document.querySelector('#inTabs [data-itab="proj"]'), null, { timeout: 120000 });
  await p.evaluate(name => { localStorage.clear(); const P = PSBModel.newProject(); P.project.name = name; P.xs.dl.swL = { w: 6, t: 9 }; P.xs.dl.ped = 75;
    P.xs.dl.extra = [{ name: 'Gas main', cat: 'UTN', x: 16.5, plf: 0.10 }, { name: 'Future utility', cat: 'UF', x: 16.5, plf: 0.05 }, { name: 'Water main', cat: 'UT', x: 25, plf: 0.06 }];
    localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); }, NAME);
  await p.reload(); await p.waitForFunction(() => window.PSBHandoffUI && document.querySelector('#inTabs [data-itab="proj"]') && document.getElementById('out').innerText.length > 50, null, { timeout: 120000 });
  await p.click('#inTabs [data-itab="proj"]'); await p.waitForSelector('#psbHo [data-ho="subSend"]');
  await p.click('#psbHo [data-ho="subSend"]');
  try { await p.waitForFunction(k => !!localStorage.getItem(k), NS + 'superReactions.by.psbridge.' + PID, { timeout: 180000 }); } catch (e) { throw new Error('not sent: ' + JSON.stringify(dialogs).slice(0, 1500) + ' keys ' + (await p.evaluate(() => Object.keys(localStorage).join(', ')))); } await p.waitForTimeout(400);
  const own = await p.evaluate(() => { const P = PSBModel.load(localStorage).project, A = PSBBridge.results(P, i => PSBHoldDown.compute(JSON.parse(JSON.stringify(i)))).cells; const r = PSBHandoffs.srAll(P, A); return { payload: r.payload, sum: r.sum }; });
  const strip = o => { const c = JSON.parse(JSON.stringify(o)); ['producedAt', 'contentHash', 'device'].forEach(k => delete c[k]); return c; };
  const sr = await p.evaluate(ns => JSON.parse(localStorage.getItem(ns + 'superReactions')), NS);
  assert.deepEqual(strip(sr), strip(own.payload));
  sr.supports.forEach(s => s.girders.forEach(g => assert.deepEqual(g.separate, { PL: 4.05, PLmin: 0, UT: 1.2, UF: 0.6, UTc: 0.72 }, `${s.id} ${g.label}`)));
  assert.equal(sr.separate.pedestrian.includedIn, null); assert.equal(sr.separate.utilities.existing.includedIn, 'DC1'); assert.equal(sr.separate.utilities.composite.includedIn, 'DW');
  assert.match(dialogs.at(-1), /^Kept for project "Mill Road over Stony Brook"/); assert.match(own.sum, /Separate items \(optional fields; UT and UF are inside DC1, UTc inside DW, PL in no other field\), kip:\n  Abut\. 1: G1 PL 4\.05 PLmin 0\.00 UT 1\.20 UF 0\.60 UTc 0\.72/);   // the message shows the builder's summary (the recorded dialog text is cut short)
  ok(`sender: superReactions with girders[].separate { PL 4.05, PLmin 0, UT 1.2, UF 0.6, UTc 0.72 } on every girder; G2 DC1 ${sr.supports[0].girders[1].DC1} (contains UT + UF), DW ${sr.supports[0].girders[1].DW} (contains UTc) kip`);
  await p.click('#psbHo [data-ho="srSend"]'); await p.waitForTimeout(500);
  const one = await p.evaluate(ns => JSON.parse(localStorage.getItem(ns + 'superReactions.by.psbeam')), NS);
  assert.equal(one.allGirders, undefined); assert.deepEqual(one.supports[0].girders[0].separate, { PL: 4.05, PLmin: 0, UT: 1.2, UF: 0.6, UTc: 0.72 }); 
  ok('sender: the one-line "Send reactions" payload carries the same separate items');
  await p.click('#psbHo [data-ho="subSend"]'); await p.waitForTimeout(2500);
  const last = await p.evaluate(ns => JSON.parse(localStorage.getItem(ns + 'superReactions')), NS); assert.equal(last.allGirders, true);
  // ---- receiver ----
  const q = await ctx.newPage(); const errs2 = [];
  q.on('console', m => { if (m.type() === 'error') errs2.push(m.text().slice(0, 300)); }); q.on('pageerror', e => errs2.push('pageerror: ' + e.message)); q.on('dialog', async d => { await d.accept(); });
  await q.goto('file://' + path.join(REPO, 'Bridge Substructure Loading.html'));
  await q.waitForFunction(() => typeof P === 'object' && !!document.querySelector('.itab[data-pane="bridge"]'));
  await q.click('.itab[data-pane="project"]'); await q.fill('[data-k="meta.name"]', NAME); await q.dispatchEvent('[data-k="meta.name"]', 'input'); await q.dispatchEvent('[data-k="meta.name"]', 'change');
  await q.click('.itab[data-pane="project"]'); await q.waitForSelector('#slHo #geo-pull');
  await q.click('#geo-pull'); await q.waitForSelector('#gxp-modal tr[data-gxp-row]'); await q.click('#gxp-next'); await q.waitForSelector('#gxg-apply'); await q.click('#gxg-apply'); await q.waitForTimeout(500);
  await q.click('.itab[data-pane="project"]'); await q.waitForSelector('#slHo #rx-pull'); await q.click('#rx-pull'); await q.waitForSelector('#gxp-modal tr[data-gxp-row]');
  await q.click('#gxp-next'); await q.waitForSelector('#rxh-apply');
  const dlg = await q.evaluate(() => ({ sep: document.querySelector('#rxh-sep').innerText, head: [...document.querySelectorAll('#rxh-modal table.mini-t thead th')].map(t => t.innerText.replace(/\s+/g, ' ').trim()), row: [...document.querySelectorAll('#rxh-modal table.mini-t')].at(-1).querySelector('tbody tr').innerText.replace(/\s+/g, ' ') }));
  assert.match(dlg.sep, /taken out of DC1 here/); assert.match(dlg.sep, /UTc .* is inside DW and stays there/); assert.match(dlg.sep, /PL .*information only, not applied here/); assert.match(dlg.sep, /NO pedestrian load is in this tool's analysis/);
  for (const hh of ['DC1', 'DC2', 'DW', 'UT', 'UF', 'UTc (in DW)', 'PL (info)']) assert.ok(dlg.head.includes(hh), `column ${hh}: ${dlg.head.join(' | ')}`);
  const g1 = last.supports[0].girders[0]; const shown = +(/\) ([\d.]+) /.exec(dlg.row) || [])[1]; near(shown, g1.DC1 - 1.8, 0.0051, `the DC1 column is net of UT + UF: ${dlg.row}`);
  if (shots) await q.locator('#rxh-modal .modal-box').screenshot({ path: path.join(shots, 'SRP-subloads-rx-dialog.png') });
  ok(`receiver dialog: the separate items explained; columns ${dlg.head.slice(1, 8).join(', ')}; DC1 shown net (${(g1.DC1 - 1.8).toFixed(2)} of ${g1.DC1})`);
  await q.click('#rxh-apply'); await q.waitForTimeout(600);
  const rx = await q.evaluate(() => JSON.parse(JSON.stringify({ d: P.rx.data, src: P.rxSrc[P.rxSrc.length - 1], tot: rxTotals(MODEL.G), uf: !!(unitRes(0).DL && unitRes(0).DL.UF), C: MODEL.C })));
  last.supports.forEach((s, k) => { let sum = 0; s.girders.forEach((g, j) => { const c = rx.d[k][j]; sum += g.DC1 + g.DC2 + g.DW;
    near(c.dc1, g.DC1 - 1.8, 1e-9, `${s.id} ${g.label} dc1 net`); assert.equal(c.ut, 1.2); assert.equal(c.uf, 0.6); assert.equal(c.dw, g.DW); assert.equal(c.dc2, g.DC2);
    near(c.dc1 + c.ut + c.uf, g.DC1, 1e-9, 'dc1 + ut + uf = the DC1 sent'); assert.equal(c.pl, undefined, 'PL is not stored as a reaction'); });
    near(rx.tot[k].dc + rx.tot[k].dw, sum, 1e-6, `${s.id}: the support total DC + DW = the payload's DC1 + DC2 + DW (no double count)`); });
  assert.equal(rx.uf, true, 'UF is its own permanent load in the dead load result');
  assert.equal(rx.src.separate.fromDC1, true); near(rx.src.separate.utc, 0.72 * 10, 1e-9, 'UTc recorded'); assert.equal(rx.src.separate.pl.length, 2); assert.equal(rx.src.separate.pl[0].g['1'], 4.05);
  assert.deepEqual(rx.src.utilities, { ut: 12, uf: 6 });
  assert.ok(rx.C.some(c => c[0] === 'warn' && c[1] === 'Pedestrian load' && /no pedestrian load is in this analysis/.test(c[2])), 'the Check: pedestrian reactions received, none in this analysis');
  ok(`receiver: applied without a double count (G1 at Abut. 1: DC1 ${rx.d[0][0].dc1} + UT 1.2 + UF 0.6 = ${g1.DC1}; DW ${rx.d[0][0].dw}); UF its own permanent load; PL recorded for information; the pedestrian Check shown`);
  await q.click('.itab[data-pane="rx"]').catch(() => {}); await q.waitForTimeout(400);
  const pane = await q.evaluate(() => document.body.innerText);
  assert.match(pane, /Utilities from PS-Beam \(separate items, taken out of its DC1\)/); assert.match(pane, /pedestrian load reactions received, unfactored kip, INFORMATION ONLY, not applied/); assert.match(pane, /Abut\. 1 G1 4\.05/);
  if (shots) await q.screenshot({ path: path.join(shots, 'SRP-subloads-rx-tab.png'), fullPage: false });
  ok('receiver Reactions tab: the utilities table named for the hand-off, the hand-off source with the pedestrian reactions (information only)');
  // a sidewalk entered in the receiver: its own pedestrian load is on, the Check goes away
  const C2 = await q.evaluate(() => { P.br.swL = 4; P.br.barL = Math.max(P.br.barL || 0, 4); recompute(); return JSON.parse(JSON.stringify(MODEL.C)); });
  assert.ok(!C2.some(c => c[1] === 'Pedestrian load'), 'no Check with a sidewalk wider than 2 ft'); ok('receiver: with its own sidewalk entered the pedestrian Check is gone (its own PL is in the analysis)');
  assert.deepEqual(errs2, []); assert.deepEqual(errs, []); ok('0 console errors in both pages');
  console.log(`ps-bridge-subloads-sep: ${n} checks passed (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
} finally { await b.close(); }
