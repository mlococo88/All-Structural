#!/usr/bin/env node
// Browser test of the superGeometry hand-off (GXF, 2026-11-09; HANDOFF.md §4.14, §5.1), headless Chromium (tests/lib.mjs openPage).
// Sender: apps/steel-bridge/index.html, Project tab, "Send to Substructure Loading" with Geometry and Reactions ticked (the defaults):
//   the channel keys, the .by.<id> copies and the per-project copies of both channels are written (same payload), nothing before the
//   click; Geometry alone; no project name -> no per-project copy.
// Receiver (same browser storage): Bridge Substructure Loading.html with a second project's copy present ("Elm Street Bridge", 2 spans,
//   sent later): the Project tab marker (HOC 2026-11-10: the pulls are in the Project tab's Hand-offs card); Pull geometry -> the picker lists both projects (and the no-project copy) newest first, nothing
//   preselected for a project of another name; renamed "New steel bridge" -> that project preselected; review (current -> incoming);
//   Apply -> P.br as sent (skews sign-converted, the largest depth), units unchanged, P.geoSrc recorded, the marker cleared; the reactions
//   Pull also asks for the project first and its dialog lists that project's copy. A 2-span project adds no unit but removes Pier 2.
//   0 console errors in both pages.
//   node tests/smoke/geometry-handoff.mjs [--shots <dir>]
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const shots = (i => i > 0 ? process.argv[i + 1] : null)(process.argv.indexOf('--shots'));
const NS = 'bridgeSuite.v1.', PID = '~New steel bridge';
const t0 = Date.now();
const { b, ctx, p, errs, dialogs } = await openPage(path.join(REPO, 'apps/steel-bridge/index.html'), { vw: 1400, vh: 1000 });
const keys = () => p.evaluate(ns => Object.keys(localStorage).filter(k => k.indexOf(ns + 'super') === 0).sort(), NS);
try {
  await p.click('#inTabs [data-itab="proj"]'); await p.waitForSelector('[data-ho="subSend"]');
  assert.deepEqual(await keys(), []);   // nothing sent on load
  assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll('[data-ho-opt]')].map(i => [i.dataset.hoOpt, i.checked])), [['geo', true], ['rx', true]]);
  if (shots) await p.locator('#sbdHo').screenshot({ path: path.join(shots, 'sender-card.png') });
  await p.click('[data-ho="subSend"]');
  await p.waitForFunction(n => !!localStorage.getItem(n), NS + 'superReactions.by.steelbridge.~New steel bridge', { timeout: 180000 });
  await p.waitForTimeout(300);
  const ks = await keys();
  for (const k of ['superGeometry', 'superGeometry.updatedAt', 'superGeometry.by.steelbridge', `superGeometry.by.steelbridge.${PID}`, 'superReactions', 'superReactions.updatedAt', 'superReactions.by.girderdetail', `superReactions.by.steelbridge.${PID}`]) assert.ok(ks.includes(NS + k), `${k} missing: ${ks.join(', ')}`);
  const same = await p.evaluate(ns => ['superGeometry', 'superReactions'].map(c => { const a = localStorage.getItem(ns + c), b = localStorage.getItem(ns + c + '.by.steelbridge.~New steel bridge'); return a === b; }), NS);
  assert.deepEqual(same, [true, true]);
  const g = await p.evaluate(ns => JSON.parse(localStorage.getItem(ns + 'superGeometry')), NS);
  assert.deepEqual(g.spans, [110, 140, 110]); assert.equal(g.section.depth, 63.5); assert.equal(g.project.name, 'New steel bridge'); assert.ok(!g.device);
  assert.match(dialogs.at(-1), /^Kept for project "New steel bridge".\n\nGeometry sent: 3 spans, 110–140–110 ft, 5 girders/); assert.match(dialogs.at(-1), /Reactions sent/);
  // Geometry only, a project without a name: the latest hand-off only, no per-project copy
  await p.uncheck('[data-ho-opt="rx"]');
  await p.fill('[data-path="project.name"]', ''); await p.dispatchEvent('[data-path="project.name"]', 'change'); await p.waitForTimeout(300);
  await p.click('#inTabs [data-itab="proj"]'); await p.waitForSelector('[data-ho="subSend"]');
  assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll('[data-ho-opt]')].map(i => i.checked)), [true, false]);   // the boxes are kept while the page is open
  const n0 = dialogs.length, at0 = await p.evaluate(ns => localStorage.getItem(ns + 'superReactions.updatedAt'), NS), k0 = (await keys()).length;
  await p.click('[data-ho="subSend"]'); await p.waitForFunction(n => window.__x === undefined, null); await p.waitForTimeout(500);
  assert.equal(dialogs.length, n0 + 1); assert.match(dialogs.at(-1), /^This project has no name/); assert.match(dialogs.at(-1), /Geometry sent/); assert.doesNotMatch(dialogs.at(-1), /Reactions sent/);
  assert.equal(await p.evaluate(ns => localStorage.getItem(ns + 'superReactions.updatedAt'), NS), at0);   // reactions not re-sent
  assert.equal((await keys()).length, k0);   // no per-project copy without a project name
  assert.equal(await p.evaluate(ns => JSON.parse(localStorage.getItem(ns + 'superGeometry')).project.name, NS), '');
  assert.deepEqual(errs, []);
  console.log(`geometry-handoff (sender): OK (${((Date.now() - t0) / 1000).toFixed(1)} s)`);

  // a second project, sent later from the same app (its own per-project copy): 2 spans 100-120 ft, skews 0 / 20 / 0
  await p.evaluate(() => { const Q = SBDModel.defaultProject(); Q.project.name = 'Elm Street Bridge'; Q.spans.lengths = [100, 120]; Q.xs.skews = [0, 20, 0];
    const r = SBDHandoffs.sgPayload(Q); const w = BridgeXfer.publish('superGeometry', r.payload, 'Steel Bridge Design', 'apps/steel-bridge/index.html');
    SharedHandoffStore.write(localStorage, 'superGeometry', 'steelbridge', w.payload); });
  // ---- receiver ----
  const q = await ctx.newPage(); const errs2 = [], dl2 = [];
  q.on('console', m => { if (m.type() === 'error') errs2.push(m.text().slice(0, 300)); }); q.on('pageerror', e => errs2.push('pageerror: ' + e.message)); q.on('dialog', async d => { dl2.push(d.message()); await d.accept(); });
  await q.goto('file://' + path.join(REPO, 'Bridge Substructure Loading.html'));
  await q.waitForFunction(() => typeof P === 'object' && !!document.querySelector('.itab[data-pane="bridge"]'));
  const br0 = await q.evaluate(() => JSON.parse(JSON.stringify(P.br)));
  await q.click('.itab[data-pane="project"]'); await q.waitForSelector('#slHo #geo-pull');
  assert.equal(await q.evaluate(() => !!document.getElementById('geo-new')), false);   // no copy matches "Example three-span continuous", nothing pulled yet
  await q.click('#geo-pull'); await q.waitForSelector('#gxp-modal tr[data-gxp-row]');
  const pk = await q.evaluate(() => ({ rows: [...document.querySelectorAll('#gxp-modal tbody tr')].map(r => [...r.cells].slice(1).map(c => c.innerText.trim())), checked: document.querySelectorAll('#gxp-modal input[type=radio]:checked').length, next: document.getElementById('gxp-next').disabled }));
  assert.deepEqual(pk.rows.map(r => r[1]), ['Elm Street Bridge', 'earlier hand-off (no project)', 'New steel bridge']);   // newest first
  assert.match(pk.rows[0][4], /^2 spans, 100–120 ft, 5 girders/); assert.match(pk.rows[2][4], /^3 spans, 110–140–110 ft, 5 girders/); assert.equal(pk.rows[2][3], 'this browser');
  assert.equal(pk.checked, 0); assert.equal(pk.next, true);
  if (shots) await q.locator('#gxp-modal .modal-box').screenshot({ path: path.join(shots, 'picker-nomatch.png') });
  await q.click('#gxp-cancel');
  // a SubLoads project named like the sent one: preselected
  await q.click('.itab[data-pane="project"]'); await q.fill('[data-k="meta.name"]', 'New steel bridge'); await q.dispatchEvent('[data-k="meta.name"]', 'input'); await q.dispatchEvent('[data-k="meta.name"]', 'change');
  await q.click('.itab[data-pane="project"]'); await q.waitForSelector('#slHo #geo-pull');
  assert.equal(await q.evaluate(() => !!document.getElementById('geo-new')), true);   // a copy matches the open project
  assert.equal(await q.evaluate(() => document.querySelector('.itab[data-pane="project"]').classList.contains('bx-new')), true);   // HOC: the marker is on the Project tab (Hand-offs card)
  await q.click('#geo-pull'); await q.waitForSelector('#gxp-modal tr[data-gxp-row]');
  assert.equal(await q.evaluate(() => { const r = document.querySelector('#gxp-modal input[type=radio]:checked'); return r && r.closest('tr').cells[2].innerText.trim(); }), 'New steel bridge');
  if (shots) await q.locator('#gxp-modal .modal-box').screenshot({ path: path.join(shots, 'picker-preselected.png') });
  await q.click('#gxp-next'); await q.waitForSelector('#gxg-apply');
  const rv = await q.evaluate(() => [...document.querySelectorAll('#gxg-modal tbody tr')].map(r => [...r.cells].map(c => c.innerText.trim())).filter(r => r.length === 4));
  const row = l => rv.find(r => r[0] === l);
  assert.deepEqual(row('Spans').slice(1, 3), ['110.00, 140.00, 110.00 ft', '110.00, 140.00, 110.00 ft']);
  assert.deepEqual(row('Abut. 1: skew').slice(1, 4), ['15.00 °', '0.00 °', 'changes']);
  assert.deepEqual(row('Girder depth').slice(1, 4), ['63.000 in', '63.500 in', 'changes']);
  assert.deepEqual(row('Flange width').slice(1, 3), ['16.000 in', '18.000 in']); assert.deepEqual(row('Flange thickness').slice(1, 3), ['1.250 in', '2.000 in']);
  assert.deepEqual(row('Barrier height').slice(1, 4), ['42.00 in', '42.00 in (not sent: kept)', '']);
  if (shots) await q.locator('#gxg-modal .modal-box').screenshot({ path: path.join(shots, 'review.png') });
  // depth override: a per-support choice, then back to the largest
  await q.selectOption('[data-gxg="depth"]', 's0'); assert.deepEqual((await q.evaluate(() => SubLoadsGeoHandoff.plan().nu.d)), 61.875);
  await q.selectOption('[data-gxg="depth"]', 'max');
  const K0 = await q.evaluate(() => P.br.skCorr === 'yes' && !(parseFloat(P.br.skKg) > 0) ? skewKgEst().Kg : null);
  await q.click('#gxg-apply'); await q.waitForTimeout(500);
  const br1 = await q.evaluate(() => JSON.parse(JSON.stringify(P.br))), src = await q.evaluate(() => P.geoSrc), nU = await q.evaluate(() => P.units.map(u => u.name));
  for (const k of ['spans', 'bays', 'ohL', 'ohR', 'barL', 'barR', 'barH', 'ts', 'haunch', 'tw', 'elev', 'joint']) assert.deepEqual(br1[k], br0[k], k);   // the default SubLoads bridge already matched these
  assert.deepEqual(br1.skews, [0, 0, 0, 0]); assert.equal(br1.d, 63.5); assert.equal(br1.bf, 18); assert.equal(br1.tf, 2);
  if (K0 != null) assert.equal(br1.skKg, K0);   // the box was off: the skew-correction K_g in use is kept
  assert.deepEqual(nU, ['Abut. 1', 'Pier 1', 'Pier 2', 'Abut. 2']);
  assert.equal(src.pid, '~New steel bridge'); assert.equal(src.depthChoice, 'largest'); assert.equal(src.skewSign, 'flip'); assert.equal(src.producer, 'Steel Bridge Design');
  assert.equal(await q.evaluate(() => !!document.getElementById('geo-new')), false);
  await q.click('.itab[data-pane="bridge"]'); assert.equal(await q.locator('#sidebar [data-go-ho]').count(), 1);   // HOC: the Bridge tab links to the Hand-offs card
  assert.match(await q.evaluate(() => document.getElementById('geo-src').innerText), /^Bridge geometry from Steel Bridge Design/);
  await q.waitForTimeout(400); assert.equal(await q.evaluate(() => JSON.parse(localStorage.getItem('subloads_v1')).geoSrc.pid), '~New steel bridge');   // saved with the project (autosave)
  // reactions pull: the picker first, then the reactions dialog with that project's copy (the app's per-project copy)
  await q.click('.itab[data-pane="project"]'); await q.waitForSelector('#slHo #rx-pull'); await q.click('#rx-pull'); await q.waitForSelector('#gxp-modal tr[data-gxp-row]');
  const rxRows = await q.evaluate(() => [...document.querySelectorAll('#gxp-modal tbody tr')].map(r => r.cells[2].innerText.trim()));
  assert.deepEqual(rxRows, ['New steel bridge']);   // the reactions were sent for that project only
  assert.equal(await q.evaluate(() => !!document.querySelector('#gxp-modal input[type=radio]:checked')), true);
  await q.click('#gxp-next'); await q.waitForSelector('#rxh-apply');
  assert.match(await q.evaluate(() => document.querySelector('#rxh-modal').innerText), /Steel Bridge Design/);
  await q.click('#rxh-apply'); await q.waitForTimeout(300);
  assert.equal(await q.evaluate(() => P.rxSrc[P.rxSrc.length - 1].pid), '~New steel bridge');
  // the 2-span project: Pier 2 removed (listed), Abut. 2 kept
  await q.click('.itab[data-pane="project"]'); await q.click('#geo-pull'); await q.waitForSelector('#gxp-modal tr[data-gxp-row]');
  await q.click('#gxp-modal tbody tr:nth-child(1)'); await q.click('#gxp-next'); await q.waitForSelector('#gxg-apply');
  const t2 = await q.evaluate(() => document.querySelector('#gxg-modal').innerText);
  assert.match(t2, /Removed with their inputs: Pier 2/); assert.match(t2, /reactions on the Reactions tab are for 4 supports × 5 girders; the incoming bridge has 3 supports/);
  if (shots) await q.locator('#gxg-modal .modal-box').screenshot({ path: path.join(shots, 'review-2span.png') });
  await q.click('#gxg-apply'); await q.waitForTimeout(400);
  assert.deepEqual(await q.evaluate(() => [P.br.spans, P.br.skews, P.units.map(u => u.name)]), [[100, 120], [0, -20, 0], ['Abut. 1', 'Pier 1', 'Abut. 2']]);
  assert.deepEqual(errs2, []); assert.deepEqual(errs, []);
  console.log(`geometry-handoff (sender + receiver): OK (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
} finally { await b.close(); }
