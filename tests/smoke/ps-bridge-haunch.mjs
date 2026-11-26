#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), HP (2026-11-25, engineer decision: t_h is the minimum haunch at midspan; engine/haunch.js): the
// Camber & deflection tab shows the haunch along the girder t_h + Δ_deck(1 − ψ).
// Headless Chromium, file://, the CDN libraries from tests/libs. A made-up NEXT 24F, 45 ft, flange 120 in, t_h = 2 in, 44 straight strands
// (Δ_deck = 3.346 in), owner RIDOT:
//   1. the net camber card: haunch at midspan 2.00 in, at the bearings 5.35 in (each with its § link);
//   2. the tenth-point table: 5.35 at x = 0 and 45 ft, 4.14 at 4.5 ft, 2.00 at 22.5 ft; the note says t_h is the minimum at midspan and
//      carries the RIDOT BDM 9.4.6 warning (over 4 in);
//   3. the worked steps cb.haunch (2.00) and cb.haunchBrg (5.35); the along-girder chart is drawn; the check summary column lists the warning;
//   4. HP-SAG (engineer 2026-11-26): no sag banner here; with 6 strands (Δ_deck = −0.32 in) t_h stays at midspan (2.00), the bearings 1.68 in,
//      and the red sag banner (#sagNotice) is above every output tab;
//   0 console errors.
//   SHOT=<file.png> node tests/smoke/ps-bridge-haunch.mjs   (a screenshot of the haunch card and the along-girder chart when SHOT is set)
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const SHOT = process.env.SHOT;
const FILE = path.join(REPO, 'apps/ps-bridge/index.html');
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, p, errs } = await openPage(FILE, { vw: 1280, vh: 1000, dsf: 1 });
const tab = async t => { await p.click(`#tabBar [data-otab="${t}"]`); await p.waitForTimeout(800); };
try {
  await p.waitForSelector('#tabBar [data-otab]');
  await p.evaluate(() => { localStorage.clear(); const P = PSBModel.newProject(); P.base.owner = 'RIDOT'; P.base.girder = 'NEXT 24F'; P.spans.lengths = [45]; P.xs.bays = P.xs.bays.map(() => 10);
    P.base.ts = 8; P.base.th = 2; P.base.rows = [{ n: 16, y: 2.875, dbnd: 0, nd: 0 }, { n: 16, y: 4.875, dbnd: 0, nd: 0 }, { n: 12, y: 6.875, dbnd: 0, nd: 0 }]; P.base.harp.n = 0;
    P.base.loads.wNC = 0; P.base.loads.wBar = 0.5; P.base.loads.wDW = 0.3; localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); });
  await p.reload(); await p.waitForSelector('#tabBar [data-otab]', { timeout: 90000 });
  await tab('camb'); await p.waitForSelector('#card-cbhaunch');
  let r = await p.evaluate(() => { const c = document.querySelector('#card-cbnet').innerText.replace(/\s+/g, ' ');
    return { c, links: [...document.querySelectorAll('#card-cbnet a.wk')].map(a => a.getAttribute('href')) }; });
  assert.match(r.c, /Haunch at midspan 2\.00 in § ?, at the bearings 5\.35 in/, r.c.slice(-300));
  assert.ok(r.links.includes('#st-cb.haunch') && r.links.includes('#st-cb.haunchBrg'), r.links.join(' '));
  ok('net camber card: haunch 2.00 in at midspan, 5.35 in at the bearings, with § links');
  r = await p.evaluate(() => { const c = document.querySelector('#card-cbhaunch'), rows = [...c.querySelectorAll('tbody tr')].map(tr => [...tr.cells].map(td => td.innerText.trim()));
    return { rows, note: c.querySelector('p.note').innerText.replace(/\s+/g, ' ') }; });
  const at = x => r.rows.find(q => q[0] === x);
  assert.equal(at('0.0')[5], '5.35'); assert.equal(at('45.0')[5], '5.35'); assert.equal(at('4.5')[5], '4.14'); assert.equal(at('22.5')[5], '2.00');
  assert.match(r.note, /is the minimum haunch, at midspan at the girder centreline/); assert.match(r.note, /RIDOT BDM 9\.4\.6: haunch up to 5\.35 in \(at the bearings/);
  ok('tenth-point table 5.35 / 4.14 / 2.00 in; the note (t_h the minimum at midspan) and the RIDOT 9.4.6 warning');
  r = await p.evaluate(() => { const d = document.querySelector('details.sg-t[data-sgk="net"]'); if (d) { d.open = true; d.dispatchEvent(new Event('toggle')); }
    const s = id => { const li = document.getElementById('st-' + id); return li ? li.innerText.replace(/\s+/g, ' ') : null; };
    return { mid: s('cb.haunch'), brg: s('cb.haunchBrg'), chart: !!document.querySelector('#gfx_cb_along svg') }; });
  assert.ok(r.mid && /2\.00 in/.test(r.mid), String(r.mid)); assert.ok(r.brg && /5\.35 in/.test(r.brg), String(r.brg)); assert.ok(r.chart, 'along-girder chart');
  ok('worked steps cb.haunch = 2.00 in, cb.haunchBrg = 5.35 in; the along-girder chart drawn');
  r = await p.evaluate(() => document.body.innerText.includes('RIDOT BDM 9.4.6: haunch up to 5.35 in'));
  assert.ok(r, 'the warning on the page'); ok('the warning is listed');
  // HP-SAG (engineer 2026-11-26): no sag banner here; with 6 strands the girder sags at deck placement: t_h stays at midspan, the banner on every output tab
  assert.equal(await p.evaluate(() => !!document.getElementById('sagNotice')), false, 'no sag banner without sag'); ok('no sag banner when Δ_deck ≥ 0');
  if (!SHOT) {
    await p.evaluate(() => { localStorage.clear(); const P = PSBModel.newProject(); P.base.owner = 'RIDOT'; P.base.girder = 'NEXT 24F'; P.spans.lengths = [45]; P.xs.bays = P.xs.bays.map(() => 10);
      P.base.ts = 8; P.base.th = 2; P.base.rows = [{ n: 6, y: 2.875, dbnd: 0, nd: 0 }]; P.base.harp.n = 0;
      P.base.loads.wNC = 0; P.base.loads.wBar = 0.5; P.base.loads.wDW = 0.3; localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); });
    await p.reload(); await p.waitForSelector('#tabBar [data-otab]', { timeout: 90000 }); await tab('camb'); await p.waitForSelector('#card-cbhaunch');
    r = await p.evaluate(() => { const n = document.getElementById('sagNotice'), c = document.querySelector('#card-cbhaunch'), rows = [...c.querySelectorAll('tbody tr')].map(tr => [...tr.cells].map(td => td.innerText.trim()));
      return { n: n ? n.innerText.replace(/\s+/g, ' ') : null, role: n && n.getAttribute('role'), link: !!(n && n.querySelector('[data-gotab="camb"]')), b0: rows[0][5], bm: rows[5][5] }; });
    assert.ok(r.n && /Girder sags at deck placement/.test(r.n) && /Δdeck = -0\.32 in, haunch at the bearings 1\.68 in \(th = 2\.00 in\)/.test(r.n), String(r.n));
    assert.equal(r.role, 'alert'); assert.ok(r.link, 'link to the Camber tab'); assert.equal(r.b0, '1.68'); assert.equal(r.bm, '2.00');
    await tab('flex'); assert.ok(await p.evaluate(() => !!document.getElementById('sagNotice')), 'banner on another output tab');
    ok('sag: banner (role alert, the line, Δ_deck −0.32, bearings 1.68 in) on the Camber and Flexure tabs; table 1.68 at the bearings, 2.00 at midspan');
  }
  if (SHOT) { await p.setViewportSize({ width: 1280, height: 2600 }); await p.waitForTimeout(600);
    const c1 = await p.$('#card-cbhaunch'), c2 = await p.$('#gfx_cb_along');
    const b1 = await c2.boundingBox(), b2 = await c1.boundingBox(), y0 = Math.min(b1.y, b2.y), y1 = Math.max(b1.y + b1.height, b2.y + b2.height);
    await p.screenshot({ path: SHOT, clip: { x: Math.min(b1.x, b2.x), y: y0, width: Math.max(b1.width, b2.width), height: y1 - y0 } }); ok('screenshot ' + SHOT); }
  assert.deepEqual(errs, [], 'console errors'); ok('0 console errors');
  console.log(`\n${n} passed`);
} finally { await b.close(); }
