#!/usr/bin/env node
// HHO (2026-11-25): the PS Bridge app's geometry hand-off with the haunch at the CL bearings -> Bridge Substructure Loading, headless
// Chromium, file:// (one localStorage). A made-up NEXT 24F, one 45 ft span, flange 120 in, t_h = 2 in, 44 straight strands (Δ_deck = 3.346 in):
//   1. PS Bridge, Project tab, Hand-offs: the card says what is sent ("haunch at the CL bearings = t_h + Δ_deck = 2.00 + 3.35 = 5.35 in", with
//      its § link to the Camber & deflection step); Send to Substructure Loading (Geometry): deck.haunch 2, deck.haunchBrg 5.3458, haunchMid 2;
//   2. Bridge Substructure Loading: Pull geometry, the review row names deck.haunchBrg, Apply: P.br.haunch = 5.3458, P.geoSrc.haunchBrg, the
//      Bridge tab's source line says where the haunch came from;
//   3. the receiver's values with the haunch at the bearings (after) and with t_h = 2 in (before, P.br.haunch set back and recomputed):
//      superstructure depth, bottom of girder and bearing seat of G1 at each abutment, the bridge seat, the stem height, the wind exposed
//      depth and pressure on the superstructure (Strength III); printed as a table (TABLE=1 prints markdown). 0 console errors.
//   SHOT=<file.png> node tests/smoke/ps-bridge-haunch-handoff.mjs   (the PS card's haunch line and the SubLoads review)
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const SHOT = process.env.SHOT, NAME = 'Haunch hand-off check', NS = 'bridgeSuite.v1.';
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, ctx, p, errs } = await openPage(path.join(REPO, 'apps/ps-bridge/index.html'), { vw: 1400, vh: 1100 });
try {
  await p.waitForSelector('#tabBar [data-otab]');
  await p.evaluate(nm => { localStorage.clear(); const P = PSBModel.newProject(); P.project.name = nm; P.base.girder = 'NEXT 24F'; P.spans.lengths = [45]; P.xs.bays = P.xs.bays.map(() => 10);
    P.base.ts = 8; P.base.th = 2; P.base.rows = [{ n: 16, y: 2.875, dbnd: 0, nd: 0 }, { n: 16, y: 4.875, dbnd: 0, nd: 0 }, { n: 12, y: 6.875, dbnd: 0, nd: 0 }]; P.base.harp.n = 0;
    P.base.loads.wNC = 0; P.base.loads.wBar = 0.5; P.base.loads.wDW = 0.3; PSBBridge.syncSpans(P); localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); }, NAME);
  await p.reload(); await p.waitForFunction(() => window.PSBHandoffUI && document.getElementById('out').innerText.length > 50, null, { timeout: 120000 });
  await p.click('#inTabs [data-itab="proj"]'); await p.waitForSelector('#psbHo [data-ho="subSend"]');
  await p.waitForFunction(() => !!document.getElementById('hoHaunch'), null, { timeout: 120000 }).catch(async () => { await p.click('#inTabs [data-itab="gird"]'); await p.waitForTimeout(800); await p.click('#inTabs [data-itab="proj"]'); await p.waitForSelector('#hoHaunch', { timeout: 60000 }); });
  const line = await p.evaluate(() => document.getElementById('hoHaunch').innerText.replace(/\s+/g, ' '));
  assert.match(line, /haunch at the CL bearings \(deck\.haunchBrg\) = th \+ Δdeck = 2\.00 \+ 3\.35 = 5\.35 in/, line);
  assert.match(line, /deck\.haunch = th = 2\.00 in, the entered minimum/); assert.ok(await p.$('#hoHaunch a.wk[href="#st-cb.haunchBrg"]'), '§ link');
  ok('PS card: ' + line.slice(0, 120) + '…');
  if (SHOT) await (await p.$('#hoHaunch')).screenshot({ path: SHOT });
  await p.evaluate(() => { document.querySelector('#psbHo [data-ho-opt="rx"]').checked = false; document.querySelector('#psbHo [data-ho-opt="rx"]').dispatchEvent(new Event('change', { bubbles: true })); });
  await p.click('#psbHo [data-ho="subSend"]'); await p.waitForFunction(k => !!localStorage.getItem(k), NS + 'superGeometry.by.psbridge', { timeout: 120000 });
  const sg = await p.evaluate(k => JSON.parse(localStorage.getItem(k)), NS + 'superGeometry');
  assert.equal(sg.deck.haunch, 2); assert.equal(sg.deck.haunchBrg.toFixed(4), '5.3458'); assert.equal(sg.deck.haunchMid, 2); ok(`sent: deck ${JSON.stringify(sg.deck)}`);
  // ---- receiver ----
  const q = await ctx.newPage(); const errs2 = [];
  q.on('console', m => { if (m.type() === 'error') errs2.push(m.text().slice(0, 300)); }); q.on('pageerror', e => errs2.push('pageerror: ' + e.message)); q.on('dialog', async d => { await d.accept(); });
  await q.setViewportSize({ width: 1400, height: 1100 });
  await q.goto('file://' + path.join(REPO, 'Bridge Substructure Loading.html'));
  await q.waitForFunction(() => typeof P === 'object' && !!document.querySelector('.itab[data-pane="bridge"]'));
  await q.click('.itab[data-pane="project"]'); await q.fill('[data-k="meta.name"]', NAME); await q.dispatchEvent('[data-k="meta.name"]', 'input'); await q.dispatchEvent('[data-k="meta.name"]', 'change');
  await q.click('.itab[data-pane="project"]'); await q.waitForSelector('#slHo #geo-pull'); await q.click('#geo-pull'); await q.waitForSelector('#gxp-modal tr[data-gxp-row]');
  await q.click('#gxp-next'); await q.waitForSelector('#gxg-apply');
  const tx = await q.evaluate(() => document.querySelector('#gxg-modal').innerText);
  assert.match(tx, /Haunch \(at the CL bearings: deck\.haunchBrg; sent th 2\.00 in is the minimum at midspan\)\s+2\.00 in\s+5\.35 in/, tx.slice(tx.indexOf('Haunch'), tx.indexOf('Haunch') + 200));
  ok('SubLoads review: the haunch row names deck.haunchBrg (2.00 -> 5.35 in)');
  if (SHOT) { const r = await q.$('#gxg-modal .modal-box'); await r.screenshot({ path: SHOT.replace(/\.png$/, '-subloads.png') }); }
  await q.click('#gxg-apply'); await q.waitForTimeout(800);
  const vals = () => q.evaluate(() => { recompute(); const G = MODEL.G, UG = MODEL.UG, w = windSuper(G, 'III');
    const at = k => { const S = G.sup[k], g1 = S.rows[0].brg[0], R = UG[k]; return { zGb: g1.zGb, zSeat: g1.zSeat, seat: R.seat, stemTop: R.stemTop, H: R.H }; };
    return { haunch: P.br.haunch, dSup: G.dSup, a1: at(0), a2: at(G.sup.length - 1), wD: w.D, w0: w.w0, wT: w.wT[0] }; });
  const after = await vals(), src = await q.evaluate(() => JSON.parse(JSON.stringify(P.geoSrc)));
  assert.equal(after.haunch.toFixed(4), '5.3458'); assert.equal(src.haunchBrg.v, after.haunch); assert.equal(src.haunchBrg.min, 2);
  await q.click('.itab[data-pane="bridge"]'); await q.waitForSelector('#geo-src'); const sl = await q.evaluate(() => document.getElementById('geo-src').innerText);
  assert.match(sl, /haunch \(5\.346 in at the CL bearings, the sender's deck\.haunchBrg: its entered minimum 2\.000 in plus the camber at deck placement/); ok('SubLoads: applied, P.geoSrc.haunchBrg; the Bridge tab says where the haunch came from');
  const before = await q.evaluate(() => { P.br.haunch = 2; return true; }) && await vals();
  const f = (v, d = 3) => (+v).toFixed(d), rows = [
    ['Haunch used, br.haunch (in)', before.haunch, after.haunch, 4], ['Superstructure depth d_sup = (t_s + haunch + d)/12 (ft)', before.dSup, after.dSup, 4],
    ['Abut. 1, G1 bottom of girder (ft)', before.a1.zGb, after.a1.zGb, 3], ['Abut. 1, G1 bearing seat (ft)', before.a1.zSeat, after.a1.zSeat, 3], ['Abut. 1 bridge seat (ft)', before.a1.seat, after.a1.seat, 3],
    ['Abut. 1 stem top (ft)', before.a1.stemTop, after.a1.stemTop, 3], ['Abut. 1 stem height H (ft)', before.a1.H, after.a1.H, 3],
    ['Abut. 2 bridge seat (ft)', before.a2.seat, after.a2.seat, 3], ['Abut. 2 stem height H (ft)', before.a2.H, after.a2.H, 3],
    ['Wind, exposed depth D (ft)', before.wD, after.wD, 4], ['Wind on the superstructure, Strength III, 0° (klf)', before.wT, after.wT, 4]];
  near(after.dSup - before.dSup, (after.haunch - 2) / 12, 1e-12, 'd_sup grows by the haunch'); near(before.a1.zSeat - after.a1.zSeat, (after.haunch - 2) / 12, 1e-9, 'seat lowered by the haunch');
  console.log(process.env.TABLE ? ['| Receiver value | Before (t_h) | After (haunch at the bearings) | Change |', '|---|---|---|---|'].concat(rows.map(([l, a, c, d]) => `| ${l} | ${f(a, d)} | ${f(c, d)} | ${f(c - a, d)} |`)).join('\n')
    : rows.map(([l, a, c, d]) => `    ${l}: ${f(a, d)} -> ${f(c, d)}`).join('\n'));
  ok('receiver values before / after printed');
  // sag (engineer 2026-11-26): with 6 strands the girder sags at deck placement: deck.haunchBrg = t_h + Δ_deck = 1.68 in, the card warns
  await p.evaluate(nm => { const P = PSBModel.newProject(); P.project.name = nm; P.base.girder = 'NEXT 24F'; P.spans.lengths = [45]; P.xs.bays = P.xs.bays.map(() => 10);
    P.base.ts = 8; P.base.th = 2; P.base.rows = [{ n: 6, y: 2.875, dbnd: 0, nd: 0 }]; P.base.harp.n = 0;
    P.base.loads.wNC = 0; P.base.loads.wBar = 0.5; P.base.loads.wDW = 0.3; PSBBridge.syncSpans(P); localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); }, NAME);
  await p.reload(); await p.waitForFunction(() => window.PSBHandoffUI && document.getElementById('out').innerText.length > 50, null, { timeout: 120000 });
  await p.click('#inTabs [data-itab="proj"]'); await p.waitForSelector('#psbHo [data-ho="subSend"]');
  await p.waitForFunction(() => !!document.getElementById('hoSag'), null, { timeout: 120000 }).catch(async () => { await p.click('#inTabs [data-itab="gird"]'); await p.waitForTimeout(800); await p.click('#inTabs [data-itab="proj"]'); await p.waitForSelector('#hoSag', { timeout: 120000 }); });
  const sline = await p.evaluate(() => document.getElementById('hoHaunch').innerText.replace(/\s+/g, ' '));
  assert.match(sline, /= max\(th \+ Δdeck, 0\.5\) = max\(2\.00 \+ \(-0\.32\), 0\.5\) = 1\.68 in, thinner than th/, sline); assert.match(sline, /sag at deck placement|sags at deck placement/, sline);
  ok('sag: the card sends 1.68 in at the bearings (< t_h) and warns');
  assert.deepEqual(errs, []); assert.deepEqual(errs2, []); ok('0 console errors in both pages');
  console.log(`\n${n} passed`);
} finally { await b.close(); }
function near(a, c, t, m) { assert.ok(Math.abs(a - c) <= t, `${m}: ${a} vs ${c}`); }
