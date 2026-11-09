#!/usr/bin/env node
// Browser test of the superGeometry hand-off (GXF, 2026-11-09; HANDOFF.md §4.14, §5.1), headless Chromium (tests/lib.mjs openPage).
// Sender: apps/steel-bridge/index.html, Project tab, "Send to Substructure Loading" with Geometry and Reactions ticked (the defaults):
//   the channel keys, the .by.<id> copies and the per-project copies of both channels are written (same payload), nothing before the
//   click; Geometry alone; no project name -> no per-project copy. 0 console errors.
//   node tests/smoke/geometry-handoff.mjs [--shots <dir>]
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const shots = (i => i > 0 ? process.argv[i + 1] : null)(process.argv.indexOf('--shots'));
const NS = 'bridgeSuite.v1.', PID = '~New steel bridge';
const t0 = Date.now();
const { b, p, errs, dialogs } = await openPage(path.join(REPO, 'apps/steel-bridge/index.html'), { vw: 1400, vh: 1000 });
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
} finally { await b.close(); }
