#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html) batch F (2026-11-15) -> Bridge Substructure Loading, headless Chromium, file:// (one localStorage):
//   Sender: Project tab, Hand-offs, "Send to Substructure Loading" with Geometry and "Reactions of every girder line" (both ticked by default):
//     nothing before the click; then superGeometry (+ .updatedAt, .by.psbridge, per-project copy .by.psbridge.~<name>) and superReactions
//     (+ .updatedAt, .by.psbeam, per-project .by.psbridge.~<name>), each = the page's own builder (engine/handoffs.js sgPayload / srAll on
//     every girder type × line); the one-line "Send reactions" button still sends the old app's payload (no allGirders).
//   Receiver (PS as the sender): Pull geometry -> the picker preselects the project of the same name; the review; the "Also update the
//     live-load distribution girder data" box is disabled for the concrete section; Apply -> P.br spans, bays, overhangs, depth 72, bf 42,
//     tf 6, tw 6 as sent, P.geoSrc producer PS-Beam. Pull reactions -> the picker, then the dialog defaults to "each girder to the girder
//     with the same number"; Apply -> P.rx.data DC1 / DC2 / DW of every girder at both abutments = the payload. 0 console errors.
//   node tests/smoke/ps-bridge-subloads.mjs [--shots <dir>]
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const shots = (i => i > 0 ? process.argv[i + 1] : null)(process.argv.indexOf('--shots'));
const NS = 'bridgeSuite.v1.', NAME = 'New prestressed bridge', PID = '~' + NAME, t0 = Date.now();
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, ctx, p, errs, dialogs } = await openPage(path.join(REPO, 'apps/ps-bridge/index.html'), { vw: 1400, vh: 1000 });
const keys = () => p.evaluate(ns => Object.keys(localStorage).filter(k => k.indexOf(ns + 'super') === 0).sort(), NS);
try {
  await p.waitForFunction(() => window.PSBHandoffUI && document.querySelector('#inTabs [data-itab="proj"]') && document.getElementById('out').innerText.length > 50, null, { timeout: 120000 });
  await p.click('#inTabs [data-itab="proj"]'); await p.waitForSelector('#psbHo [data-ho="subSend"]');
  assert.deepEqual(await keys(), []);
  assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll('#psbHo [data-ho-opt]')].map(i => [i.dataset.hoOpt, i.checked])), [['geo', true], ['rx', true]]);
  if (shots) await p.locator('#psbHo').screenshot({ path: path.join(shots, 'F1-ps-card.png') });
  await p.click('#psbHo [data-ho="subSend"]');
  await p.waitForFunction(k => !!localStorage.getItem(k), NS + 'superReactions.by.psbridge.' + PID, { timeout: 120000 }); await p.waitForTimeout(400);
  const ks = await keys();
  for (const k of ['superGeometry', 'superGeometry.updatedAt', 'superGeometry.by.psbridge', `superGeometry.by.psbridge.${PID}`, 'superReactions', 'superReactions.updatedAt', 'superReactions.by.psbeam', `superReactions.by.psbridge.${PID}`]) assert.ok(ks.includes(NS + k), `${k} missing: ${ks.join(', ')}`);
  const st = await p.evaluate(([ns, pid]) => ['superGeometry', 'superReactions'].map(c => [localStorage.getItem(ns + c), localStorage.getItem(ns + c + '.by.psbridge.' + pid), localStorage.getItem(ns + c + '.by.' + (c === 'superGeometry' ? 'psbridge' : 'psbeam'))]), [NS, PID]);
  st.forEach(([a, c, d]) => { assert.equal(a, c); assert.equal(a, d); });
  const own = await p.evaluate(() => { const P = PSBModel.load(localStorage).project, A = PSBBridge.results(P, i => PSBHoldDown.compute(JSON.parse(JSON.stringify(i)))).cells;
    return { sg: PSBHandoffs.sgPayload(P, A).payload, sr: PSBHandoffs.srAll(P, A).payload }; });
  const strip = o => { const c = JSON.parse(JSON.stringify(o)); ['producedAt', 'contentHash'].forEach(k => delete c[k]); return c; };
  const sg = JSON.parse(st[0][0]), sr = JSON.parse(st[1][0]);
  assert.deepEqual(strip(sg), strip(own.sg)); assert.deepEqual(strip(sr), strip(own.sr)); assert.equal(sr.allGirders, true); assert.equal(sg.section.material, 'prestressed concrete');
  assert.match(dialogs.at(-1), new RegExp(`^Kept for project "${NAME}".\\n\\nGeometry sent: 1 span, 120 ft, 5 girders`)); assert.match(dialogs.at(-1), /Reactions sent \(unfactored, kip, DC1 \/ DC2 \/ DW of every girder line\)/);
  ok(`sent: superGeometry and superReactions (allGirders, ${sr.supports[0].girders.length} girders), the .by copies and the per-project copies; = the page's builders`);
  assert.match(await p.textContent('#psbHo'), /Last sent:.*Geometry .*Reactions/); ok('the card shows "Last sent"');
  // the one-line send is unchanged
  await p.click('#psbHo [data-ho="srSend"]'); await p.waitForTimeout(400);
  const one = await p.evaluate(ns => JSON.parse(localStorage.getItem(ns + 'superReactions.by.psbeam')), NS); assert.equal(one.allGirders, undefined); assert.ok(one.girderLine); ok('the one-line "Send reactions" still sends the old app\'s payload');
  // re-send every line for the receiver below
  await p.click('#psbHo [data-ho="subSend"]'); await p.waitForTimeout(1500);
  // ---- receiver ----
  const q = await ctx.newPage(); const errs2 = [];
  q.on('console', m => { if (m.type() === 'error') errs2.push(m.text().slice(0, 300)); }); q.on('pageerror', e => errs2.push('pageerror: ' + e.message)); q.on('dialog', async d => { await d.accept(); });
  await q.goto('file://' + path.join(REPO, 'Bridge Substructure Loading.html'));
  await q.waitForFunction(() => typeof P === 'object' && !!document.querySelector('.itab[data-pane="bridge"]'));
  await q.click('.itab[data-pane="project"]'); await q.fill('[data-k="meta.name"]', NAME); await q.dispatchEvent('[data-k="meta.name"]', 'input'); await q.dispatchEvent('[data-k="meta.name"]', 'change');
  await q.click('.itab[data-pane="project"]'); await q.waitForSelector('#slHo #geo-pull');
  assert.equal(await q.evaluate(() => !!document.getElementById('geo-new')), true); ok('receiver: new geometry marked for the project of the same name');
  await q.click('#geo-pull'); await q.waitForSelector('#gxp-modal tr[data-gxp-row]');
  assert.equal(await q.evaluate(() => { const r = document.querySelector('#gxp-modal input[type=radio]:checked'); return r && r.closest('tr').cells[2].innerText.trim(); }), NAME);
  await q.click('#gxp-next'); await q.waitForSelector('#gxg-apply');
  const tx = await q.evaluate(() => document.querySelector('#gxg-modal').innerText);
  assert.match(tx, /PS-Beam \(apps\/ps-bridge\/index.html\)/); assert.match(tx, /The girder section sent is prestressed concrete/);
  assert.equal(await q.evaluate(() => document.querySelector('[data-gxg="lldf"]').disabled), true);
  if (shots) await q.locator('#gxg-modal .modal-box').screenshot({ path: path.join(shots, 'F1-subloads-geo-review.png') });
  await q.click('#gxg-apply'); await q.waitForTimeout(500);
  const br = await q.evaluate(() => JSON.parse(JSON.stringify({ br: P.br, src: P.geoSrc, units: P.units.map(u => u.name) })));
  assert.deepEqual(br.br.spans, sg.spans); assert.deepEqual(br.br.bays, sg.girders.spacings); assert.equal(br.br.ohL, sg.girders.ohL);
  assert.deepEqual([br.br.d, br.br.bf, br.br.tf, br.br.tw, br.br.ts, br.br.haunch], [72, 42, 6, 6, sg.deck.ts, sg.deck.haunch]);
  assert.deepEqual(br.units, ['Abut. 1', 'Abut. 2']); assert.equal(br.src.producer, 'PS-Beam'); assert.equal(br.src.pid, PID); assert.equal(br.src.lldf, false);
  ok(`receiver: geometry applied (spans ${br.br.spans}, ${br.br.bays.length + 1} girders, d 72 in, bf 42, tf 6, tw 6; K_g option off for concrete)`);
  await q.click('.itab[data-pane="project"]'); await q.waitForSelector('#slHo #rx-pull'); await q.click('#rx-pull'); await q.waitForSelector('#gxp-modal tr[data-gxp-row]');
  assert.deepEqual(await q.evaluate(() => [...document.querySelectorAll('#gxp-modal tbody tr')].map(r => r.cells[2].innerText.trim())), [NAME]);
  await q.click('#gxp-next'); await q.waitForSelector('#rxh-apply');
  const d = await q.evaluate(() => ({ byN: SubLoadsRxHandoff.state().byN, preset: SubLoadsRxHandoff.state().preset, all: SubLoadsRxHandoff.state().p.allGirders }));
  assert.deepEqual(d, { byN: true, preset: 'bynum', all: true });
  if (shots) await q.locator('#rxh-modal .modal-box').screenshot({ path: path.join(shots, 'F1-subloads-rx-dialog.png') });
  await q.click('#rxh-apply'); await q.waitForTimeout(400);
  const rx = await q.evaluate(() => JSON.parse(JSON.stringify(P.rx.data)));
  const last = await q.evaluate(ns => JSON.parse(localStorage.getItem(ns + 'superReactions')), NS);
  last.supports.forEach((s, k) => s.girders.forEach((g, j) => { const c = rx[k][j]; assert.deepEqual([c.dc1, c.dc2, c.dw], [g.DC1, g.DC2, g.DW], `${s.id} ${g.label}`); }));
  assert.equal(await q.evaluate(() => P.rxSrc[P.rxSrc.length - 1].byNumber), true);
  ok(`receiver: reactions of every girder by number (G1 DC1 ${last.supports[0].girders[0].DC1}, G2 ${last.supports[0].girders[1].DC1} kip at Abut. 1)`);
  assert.deepEqual(errs2, []); assert.deepEqual(errs, []); ok('0 console errors in both pages');
  console.log(`ps-bridge-subloads: ${n} checks passed (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
} finally { await b.close(); }
