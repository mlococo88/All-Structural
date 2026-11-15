#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), batch D3 (2026-11-15): the MCT Generator's demands hand-off and geometry changes (the old app's
// "New analysis data available" banner, Load, version check; the geometry-changes banner and review window). Headless Chromium, file://.
//   1. a hand-off published by another page (the storage event): the banner above the output tabs with the producer, project, member,
//      stations, LL type; "Load into" = the type on the member's line G2 in the span shown; Load (the span and continuity questions accepted)
//      = one Undo step: the type's demands are the member, the bridge spans / continuity the member's; the marker .adopted.psbridge written,
//      the old app's .adopted.psbeam untouched; the banner gone; Undo returns the project (the marker stays, as the old app's);
//   2. re-published (a new producedAt): the banner again; "Not now" marks it; a schema v2 payload: "newer than this app" (dismiss only);
//   3. geometry changes: the banner, the review window (the changes), Dismiss marks .geometryChanges.adopted.psbridge; the review window's
//      "Load the demands now" loads the pending hand-off (one Undo step) and marks both;
//   4. every other bridgeSuite key byte-identical; 0 console errors.
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.join(REPO, 'apps/ps-bridge/index.html');
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, ctx, p, errs, dialogs } = await openPage(FILE, { vw: 1400, vh: 1000 });
const mct = JSON.parse(fs.readFileSync(path.join(REPO, 'tests/projects/ext/mct_psbeam_selfweight_excluded.json'), 'utf8'));
const stamp = at => Object.assign({}, mct, { schemaVersion: 1, producer: 'MCT Generator', producedAt: at, handoffId: 'fixture-110-140-110-continuous__g2' });
const proj = async () => JSON.parse(await p.evaluate(() => localStorage.getItem('psb2.project.current')));
const ls = k => p.evaluate(k => localStorage.getItem(k), k);
const until = async (f, ms, w) => { const t0 = Date.now(); for (;;) { if (await f()) return; if (Date.now() - t0 > ms) throw new Error('timeout: ' + w); await new Promise(r => setTimeout(r, 100)); } };
// another page of the same origin publishes (the storage event reaches the app's page)
const q = await ctx.newPage(); await q.goto('file://' + path.join(REPO, 'tests/libs').replace(/\\/g, '/') + '/');
const publish = (o) => q.evaluate(o => Object.entries(o).forEach(([k, v]) => localStorage.setItem(k, v)), o);
try {
  await p.waitForSelector('#tabBar [data-otab]'); await p.waitForTimeout(400);
  await p.evaluate(() => { const el = document.getElementById('i_project.checker'); el.value = 'd3'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.evaluate(() => { localStorage.setItem('bridgeSuite.v1.adopted.psbeam', 'old-app-token'); });
  // the bridge: three spans, simple (the member's spans and continuity are asked)
  await p.evaluate(() => { const el = document.querySelector('[id="i_spans.lengths"]'); el.value = '100, 130, 100'; el.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(300);
  // 1.
  const p1 = stamp('2026-11-15T10:00:00.000Z');
  await publish({ 'bridgeSuite.v1.handoffs': JSON.stringify({ [p1.handoffId]: p1 }), 'bridgeSuite.v1.latestId': p1.handoffId, 'bridgeSuite.v1.updatedAt': p1.producedAt });
  await until(async () => !!(await p.$('#mctBanner.mctNew')), 10000, 'banner');
  assert.match(await p.$eval('#mctBanner', e => e.textContent), /New analysis data available from MCT Generator · Fixture 110-140-110 continuous · G2 · 62 stations · LL: HL-93/);
  const P0 = await proj(), dflt = await p.$eval('#mctType', e => e.value), T = P0.types.find(t => t.id === dflt);
  assert.ok(T && T.span === 1 && T.lines.includes(2), 'the type on line G2 of span 1: ' + JSON.stringify(T));
  const nd = dialogs.length; await p.click('[data-mct="load"]'); await p.waitForTimeout(500);
  assert.equal(dialogs.length - nd, 2, 'two questions'); const P1 = await proj();
  assert.deepEqual(P1.spans.lengths, [110, 140, 110]); assert.equal(P1.spans.continuity, 'composite');
  assert.equal(P1.demands[T.id].src, 'midas'); assert.equal(P1.demands[T.id].midas.name, 'MCT hand-off ' + p1.handoffId);
  assert.equal(await ls('bridgeSuite.v1.adopted.psbridge'), p1.handoffId + '@' + p1.producedAt); assert.equal(await ls('bridgeSuite.v1.adopted.psbeam'), 'old-app-token');
  assert.equal(await p.$('#mctBanner'), null);
  await p.click('#bUndo'); await p.waitForTimeout(300); const Pu = await proj();
  assert.equal(JSON.stringify(Pu.spans), JSON.stringify(P0.spans)); assert.equal(Pu.demands, undefined); assert.equal(await p.$('#mctBanner'), null, 'adopted marker stays (as the old app)');
  await p.click('#bRedo'); await p.waitForTimeout(300);
  ok('hand-off banner (storage event), Load into the type on G2 of span 1 with the two questions = one Undo step; .adopted.psbridge written, .adopted.psbeam untouched');
  // 2.
  const p2 = stamp('2026-11-15T11:00:00.000Z');
  await publish({ 'bridgeSuite.v1.handoffs': JSON.stringify({ [p2.handoffId]: p2 }), 'bridgeSuite.v1.updatedAt': p2.producedAt });
  await until(async () => !!(await p.$('#mctBanner.mctNew')), 10000, 'banner again');
  const t2 = JSON.stringify(await proj()); await p.click('[data-mct="dismiss"]'); await p.waitForTimeout(200);
  assert.equal(await ls('bridgeSuite.v1.adopted.psbridge'), p2.handoffId + '@' + p2.producedAt); assert.equal(JSON.stringify(await proj()), t2); assert.equal(await p.$('#mctBanner'), null);
  const p3 = Object.assign(stamp('2026-11-15T12:00:00.000Z'), { schemaVersion: 2 });
  await publish({ 'bridgeSuite.v1.handoffs': JSON.stringify({ [p3.handoffId]: p3 }), 'bridgeSuite.v1.updatedAt': p3.producedAt });
  await until(async () => /newer than this app/.test(await p.evaluate(() => (document.getElementById('mctBanner') || {}).textContent || '')), 10000, 'v2 banner');
  assert.equal(await p.$('[data-mct="load"]'), null); await p.click('[data-mct="dismiss"]'); await p.waitForTimeout(200); assert.equal(await p.$('#mctBanner'), null);
  ok('re-published: the banner again, "Not now" marks it (project unchanged); schema v2: "newer than this app", dismiss only');
  // 3.
  const g = { schemaVersion: 1, producer: 'MCT Generator', producedAt: '2026-11-15T12:30:00.000Z', changes: [{ field: 'Span 2 length', detail: 'member G2', oldVal: '130 ft', newVal: '140 ft' }, { field: 'Girder spacing', oldVal: '9.0 ft', newVal: '9.5 ft' }] };
  await publish({ 'bridgeSuite.v1.geometryChanges': JSON.stringify(g), 'bridgeSuite.v1.geometryChanges.updatedAt': g.producedAt });
  await until(async () => !!(await p.$('#mctGeoBanner')), 10000, 'geometry banner');
  await p.click('#mctGeoBanner a[data-mct="geo"]'); await p.waitForSelector('#mctGeoDlg[open]');
  assert.match(await p.$eval('#mctGeoDlg', e => e.textContent), /Span 2 length[\s\S]*member G2[\s\S]*130 ft[\s\S]*140 ft[\s\S]*Girder spacing/);
  assert.equal(await p.$('#mctGeoDlg [data-mctg="load"]'), null, 'no pending demands: no Load');
  await p.click('#mctGeoDlg [data-mctg="dismiss"]'); await p.waitForTimeout(200);
  assert.equal(await ls('bridgeSuite.v1.geometryChanges.adopted.psbridge'), g.producedAt); assert.equal(await p.$('#mctGeoBanner'), null);
  // geometry changes with demands waiting: the review window's Load
  const g2 = Object.assign({}, g, { producedAt: '2026-11-15T13:00:00.000Z' }), p4 = stamp('2026-11-15T13:00:00.000Z');
  await publish({ 'bridgeSuite.v1.handoffs': JSON.stringify({ [p4.handoffId]: p4 }), 'bridgeSuite.v1.updatedAt': p4.producedAt, 'bridgeSuite.v1.geometryChanges': JSON.stringify(g2), 'bridgeSuite.v1.geometryChanges.updatedAt': g2.producedAt });
  await until(async () => !!(await p.$('#mctGeoBanner')) && !!(await p.$('#mctBanner.mctNew')), 10000, 'both banners');
  const steps0 = await p.evaluate(() => document.getElementById('bUndo').disabled);
  await p.click('#mctGeoBanner button[data-mct="geo"]'); await p.waitForSelector('#mctGeoDlg[open]'); await p.click('#mctGeoDlg [data-mctg="load"]'); await p.waitForTimeout(400);
  assert.equal(await ls('bridgeSuite.v1.adopted.psbridge'), p4.handoffId + '@' + p4.producedAt); assert.equal(await ls('bridgeSuite.v1.geometryChanges.adopted.psbridge'), g2.producedAt);
  assert.equal(await p.$('#mctBanner'), null); assert.equal(await p.$('#mctGeoBanner'), null); assert.equal(steps0, false);
  assert.equal((await proj()).demands[T.id].midas.file.producedAt, p4.producedAt);
  ok('geometry changes: banner, review window with the changes, Dismiss marks .geometryChanges.adopted.psbridge; the window\'s Load loads the pending demands and marks both');
  // 4.
  const keys = await p.evaluate(() => Object.keys(localStorage).filter(k => /^bridgeSuite\./.test(k)).sort());
  assert.deepEqual(keys, ['bridgeSuite.v1.adopted.psbeam', 'bridgeSuite.v1.adopted.psbridge', 'bridgeSuite.v1.geometryChanges', 'bridgeSuite.v1.geometryChanges.adopted.psbridge', 'bridgeSuite.v1.geometryChanges.updatedAt', 'bridgeSuite.v1.handoffs', 'bridgeSuite.v1.latestId', 'bridgeSuite.v1.updatedAt'].filter(k => keys.includes(k)));
  assert.equal(await ls('bridgeSuite.v1.handoffs'), JSON.stringify({ [p4.handoffId]: p4 }), 'the map as published');
  assert.deepEqual(errs, []);
  const shots = process.env.SHOTS; if (shots) { await publish({ 'bridgeSuite.v1.handoffs': JSON.stringify({ [p1.handoffId]: stamp('2026-11-15T14:00:00.000Z') }), 'bridgeSuite.v1.updatedAt': '2026-11-15T14:00:00.000Z',
      'bridgeSuite.v1.geometryChanges': JSON.stringify(Object.assign({}, g, { producedAt: '2026-11-15T14:00:00.000Z' })), 'bridgeSuite.v1.geometryChanges.updatedAt': '2026-11-15T14:00:00.000Z' });
    await until(async () => !!(await p.$('#mctBanner.mctNew')), 10000, 'shot'); await p.screenshot({ path: path.join(shots, 'D3-mct-banners.png') });
    await p.click('#mctGeoBanner button[data-mct="geo"]'); await p.waitForSelector('#mctGeoDlg[open]'); await p.screenshot({ path: path.join(shots, 'D3-geometry-review.png') }); }
  ok('bridgeSuite keys: only this app\'s markers added, the map as published; 0 console errors');
  console.log(`\nps-bridge-mct: ${n} checks passed`);
} catch (e) { console.error('FAIL', e && e.stack || e); console.error(errs.join('\n')); process.exitCode = 1; }
finally { await b.close(); }
