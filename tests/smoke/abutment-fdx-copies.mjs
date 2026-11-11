#!/usr/bin/env node
// Abutment Calculator: per-project copies of the foundationLoads send (FPU, 2026-11-11; HANDOFF.md §4.6, §5.1; engineer decision 2026-11-11 "Fix both").
//   - "Send foundation loads" -> "Send to other tools" writes the channel key and .by.abutment (as before) and the per-project copy
//     bridgeSuite.v1.foundationLoads.by.abutment.<project id> = the payload exactly as published (project id = SharedHandoffStore.pidOf);
//   - a project pulled from a SubLoads abutment (S.subloadsSrc.abutment, e.g. "Abut. 1") gets the per-unit copy .by.abutment.<pid>.Abut%2E 1 instead;
//   - another project its own copy, the first kept; blank project name and bridge id: no per-project copy;
//   - Cloud sync off: no network request, no pending upload; the payload is the dialog's (no change); 0 console errors.
//   node tests/smoke/abutment-fdx-copies.mjs
import assert from 'assert/strict';
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.join(REPO, 'abutment_calculator.html'), NS = 'bridgeSuite.v1.foundationLoads';
let fails = 0; const ok = async (m, f) => { try { await f(); console.log('  ok   ' + m); } catch (e) { fails++; console.log('  FAIL ' + m + ': ' + String(e.message).slice(0, 500)); } };
const o = await openPage(FILE, { vw: 1440, vh: 1000 }), { p } = o;
try {
  await p.waitForFunction(() => window.LAST_R && window.SharedHandoffStore && document.getElementById('fdx-send'), null, { timeout: 60000 }); await p.waitForTimeout(700);
  const send = (name, unit) => p.evaluate(async ([name, unit]) => {
    S.proj.name = name; if (unit) S.subloadsSrc = { producer: 'Bridge Substructure Loading', producedAt: '2026-11-11T09:00:00.000Z', project: 'X', abutment: unit, groups: [] }; else delete S.subloadsSrc;
    document.getElementById('fdx-send').click(); await new Promise(r => setTimeout(r, 100));
    const tbl = document.getElementById('fdx-dlg').innerText; document.getElementById('fdx-go').click(); await new Promise(r => setTimeout(r, 300));
    const ks = Object.keys(localStorage).filter(x => x.indexOf('bridgeSuite.v1.foundationLoads') === 0).sort(), get = x => JSON.parse(localStorage.getItem(x) || 'null');
    const ch = get('bridgeSuite.v1.foundationLoads'), pid = SharedHandoffStore.pidOf(ch.project);
    return { ks, pid, ch, by: get('bridgeSuite.v1.foundationLoads.by.abutment'), tbl, pend: localStorage.getItem('bridgeSuite.v1.handoffStore.pending'),
      copy: pid ? get('bridgeSuite.v1.foundationLoads.by.abutment.' + pid + (unit ? '.' + SharedHandoffStore.unitId(unit) : '')) : null }; }, [name, unit || '']);
  const a = await send('Bridge A');
  await ok('send: channel key, .by.abutment and .by.abutment.<pid> hold the same published payload', () => {
    assert.equal(a.pid, '~Bridge A'); assert.deepEqual(a.copy, a.ch); assert.deepEqual(a.by, a.ch); assert.equal(a.ch.producer, 'Abutment Calculator'); assert.ok(a.ch.cases.length > 0);
    assert.ok(a.ks.includes(NS + '.by.abutment.~Bridge A')); });
  const b = await send('Bridge B', 'Abut. 1');
  await ok('a project pulled from SubLoads "Abut. 1": the per-unit copy .by.abutment.<pid>.Abut%2E 1 (= the payload); Bridge A\'s copy kept', () => {
    assert.ok(b.ks.includes(NS + '.by.abutment.~Bridge B.Abut%2E 1'), b.ks.join(' ')); assert.ok(!b.ks.includes(NS + '.by.abutment.~Bridge B')); assert.deepEqual(b.copy, b.ch);
    assert.ok(b.ks.includes(NS + '.by.abutment.~Bridge A')); });
  await ok('the copy lists in the store with its project and unit', async () => {
    const L = await p.evaluate(() => SharedHandoffStore.local({ storage: localStorage, channel: 'foundationLoads', schema: 'bridge-foundation-loads', maxVersion: 1, producers: ['abutment'] }).entries.map(e => [e.pid, e.unit]).sort());
    assert.deepEqual(L, [['~Bridge A', ''], ['~Bridge B', 'Abut%2E 1']]); });
  const c = await send('');
  await ok('blank project name and bridge id: no per-project copy (the channel key as before)', () => { assert.equal(c.pid, ''); assert.equal(c.ks.filter(x => /\.by\.abutment\./.test(x)).length, 2); });
  await ok('Cloud sync off: no network request, no pending upload', () => { assert.deepEqual([...o.blocked], []); assert.equal(c.pend, null); });
  await ok('0 console errors', () => assert.deepEqual(o.errs, []));
} finally { await o.b.close(); }
if (fails) { console.log(`${fails} failure(s)`); process.exit(1); }
console.log('all passed');
