#!/usr/bin/env node
// Steel Bridge Design.html (GirderDetail), "Send reactions to Substructure Loading" (GXF-4, 2026-11-09; HANDOFF.md §4.4, §5.1): the channel
// key, its .updatedAt and the copy superReactions.by.girderdetail are written as before, and also the per-project copy
// superReactions.by.girderdetail.<project id> (the same payload), the alert names the project. 0 console errors.
//   node tests/smoke/gd-reactions-handoff.mjs
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const NS = 'bridgeSuite.v1.superReactions', t0 = Date.now();
const { b, p, errs, dialogs } = await openPage(path.join(REPO, 'Steel Bridge Design.html'), { vw: 1400, vh: 900, timeout: 120000 });
try {
  await p.waitForFunction(() => typeof window.gdIdle === 'function' && typeof gdSrPayload === 'function', null, { timeout: 120000 });
  await p.evaluate(() => window.gdIdle({ quiet: 3000 }));
  const send = () => p.evaluate(() => { const x = document.createElement('button'); x.dataset.gdsr = 'send'; x.hidden = true; document.body.appendChild(x); x.click(); x.remove(); });
  const keys = () => p.evaluate(ns => Object.keys(localStorage).filter(k => k.indexOf(ns) === 0).sort(), NS);
  await p.evaluate(() => { const set = (s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }; set('#f_tb_name', 'Route 9 over Mill Brook'); set('#f_tb_bridge', 'B-12-034'); });
  const n0 = dialogs.length; await send();
  await p.waitForFunction(() => window.__gx === undefined && Object.keys(localStorage).some(k => /superReactions\.by\.girderdetail\./.test(k)), null, { timeout: 180000 });
  await p.waitForFunction(n => window.__dl === undefined, n0); await p.waitForTimeout(300);
  const ks = await keys(), pk = `${NS}.by.girderdetail.B-12-034~Route 9 over Mill Brook`;
  assert.deepEqual(ks, [NS, `${NS}.by.girderdetail`, pk, `${NS}.updatedAt`].sort());
  assert.equal(await p.evaluate(k => localStorage.getItem(k) === localStorage.getItem('bridgeSuite.v1.superReactions'), pk), true);
  const pl = await p.evaluate(k => JSON.parse(localStorage.getItem(k)), pk);
  assert.equal(pl.producer, 'GirderDetail'); assert.deepEqual(pl.project, { name: 'Route 9 over Mill Brook', bridgeId: 'B-12-034' }); assert.ok(!('device' in pl));
  assert.match(dialogs.at(-1), /kept for project "B-12-034 — Route 9 over Mill Brook"/);
  assert.deepEqual(errs, []);
  console.log(`gd-reactions-handoff: OK (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
} finally { await b.close(); }
