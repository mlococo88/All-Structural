#!/usr/bin/env node
// Crane Pick Analyzer (apps/crane-pick), 2026-11-17: the crane plan symbol (engine/cranegfx.js) and the aerial site plan (ui/aerial.js).
// Headless Chromium, file://, base map Satellite with MOCKED tiles (a striped 256 px PNG served with Access-Control-Allow-Origin, as the
// real tile server does). Only the SYNTHETIC fake cranes (tests/smoke/crane-fake-*.json) are used.
//   1. a wheeled and a crawler setup with a pick each: the map draws the symbol (upperworks, counterweight on the tail radius, boom to the
//      pick, hook, load); dragging the pick point turns the upperworks with the slew, every frame (drag time per move recorded);
//   2. Drawings: "SITE PLAN - AERIAL" + one per lift; the aerial sheet shows the imagery under the plan (an <image> in the sheet SVG at
//      the plan window), the attribution text; Download aerial image = PNG + .pgw in the DXF's coordinates (= the frame of the sheet in
//      the DXF), State Plane world file; DXF valid with the CRANE-* layers; Print sheet with the image;
//   3. offline: tiles refused -> "AERIAL NOT AVAILABLE - PRINTED WITHOUT BACKGROUND", the sheet still prints;
//   4. Plan tab "Print plan view": one sheet of the map view with the image; Report §Site plan (aerial) figure;
//   5. 390 px: no page-wide horizontal scroll; 0 console errors (outside the offline step's refused tiles).
//   SHOTS=<dir> node tests/smoke/crane-aerial.mjs
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const SHOTS = process.env.SHOTS;
const FILE = path.join(REPO, 'apps/crane-pick/index.html');
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs ${b} (tol ${tol})`);
// a 256 x 256 RGB tile with green / tan stripes (a recognisable "aerial")
const TILE = (() => {
  const crcT = Array.from({ length: 256 }, (_, k) => { let c = k; for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = bf => { let c = 0xffffffff; for (const x of bf) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(256, 0); ih.writeUInt32BE(256, 4); ih[8] = 8; ih[9] = 2;
  const raw = Buffer.alloc(257 * 256 * 3 / 3 * 3 + 256); let o = 0;
  for (let y = 0; y < 256; y++) { raw[o++] = 0; for (let x = 0; x < 256; x++) { const g = ((x + y) >> 4) & 1; raw[o++] = g ? 120 : 196; raw[o++] = g ? 150 : 180; raw[o++] = g ? 90 : 140; } }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw.subarray(0, o))), chunk('IEND', Buffer.alloc(0))]);
})();
const TILE_RX = /server\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Imagery/;
const { b, p, errs } = await openPage(FILE, { vw: 1280, vh: 900, ls: { 'crane.ui': '{"base":"sat","itab":"cranes"}' } });
let offline = false, tileHits = 0;
await p.route(TILE_RX, r => { tileHits++; return offline ? r.abort() : r.fulfill({ body: TILE, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' } }); });
const shot = async nm => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, nm + '.png') }); } };
const scr = q => p.evaluate(q => { const m = CranePickMap.map, cp = m.latLngToContainerPoint(CranePickMap.toLL(q)), r = m.getContainer().getBoundingClientRect(); return { x: r.x + cp.x, y: r.y + cp.y }; }, q);
try {
  await p.waitForSelector('[data-sp=chip]'); await p.waitForTimeout(300);
  await p.setInputFiles('#crFiles', [path.join(REPO, 'tests/smoke/crane-fake-wheeled.json'), path.join(REPO, 'tests/smoke/crane-fake-crawler.json')]);
  await p.waitForFunction(() => /2 cranes loaded/.test(document.querySelector('#crStatus').textContent));
  for (let i = 0; i < 2; i++) { await p.click("[data-ca=add] >> nth=0"); await p.waitForTimeout(250); }
  assert.equal(await p.evaluate(() => CranePickApp.P.cranes.length), 2, 'both cranes in the project');
  const c0 = await p.evaluate(() => { const K = CranePickCranes, M = CranePickModel, A = CranePickApp, [cw, cc] = A.P.cranes, z = CranePickGeo.zone(A.P.site.zone), o = CranePickMap.toFt(CranePickMap.map.getCenter());
    const g = (c, id) => K.groups(c.def).find(g => Object.values(g.configs).some(x => x.id === id)).key;
    A.update(P => {
      P.title = Object.assign({}, P.title, { name: 'AERIAL SMOKE' });
      P.setups.push(M.normSetup({ id: 'u0', name: 'Crane A', craneId: cw.id, x: o.x, y: o.y, heading: 30, group: g(cw, 'or-full-360'), boom: 60, pad: 100 }));
      P.setups.push(M.normSetup({ id: 'u1', name: 'Crawler B', craneId: cc.id, x: o.x + 120, y: o.y, heading: 0, group: g(cc, 'rear-150k'), boom: 100, pad: 100 }));
      P.picks.push(M.normPick({ id: 'k1', name: 'Pick 1', setupId: 'u0', pick: { x: o.x + 30 * Math.sin(75 * Math.PI / 180), y: o.y + 30 * Math.cos(75 * Math.PI / 180) }, set: { x: o.x, y: o.y + 20 }, load: 20000, rigging: 1000, hook: 1000, ded: 0, swing: 'short', elev: { L: 12, W: 4, H: 3 } }));
      P.picks.push(M.normPick({ id: 'k2', name: 'Pick 2', setupId: 'u1', pick: { x: o.x + 120, y: o.y - 40 }, set: { x: o.x + 150, y: o.y - 30 }, load: 30000, rigging: 1000, hook: 2000, ded: 0, swing: 'short' }));
      P.items.push(M.normItem({ type: 'power', name: 'OH 13.8 kV', kv: 13.8, pts: [{ x: o.x - 60, y: o.y + 70 }, { x: o.x + 200, y: o.y + 75 }] }));
    }, 'setups'); CranePickMap.fit([{ x: o.x - 60, y: o.y - 60 }, { x: o.x + 190, y: o.y + 80 }]); return o; });
  await p.click('#tabBar [data-otab=plan]'); await p.waitForTimeout(700);

  // 1. the map symbol
  const m1 = await p.evaluate(() => { const g = CranePickPlace.layers.get('u0'), u = CranePickApp.P.setups[0], ft = ll => CranePickMap.toFt(ll);
    const cw = g.sym.cwt.pg.getLatLngs()[0][0].map(ft).map(q => Math.hypot(q.x - u.x, q.y - u.y)), up = g.sym.upper.pg.getLatLngs().length, boom = g.sym.boom.pg.getLatLngs().length + g.sym.boom.pl.getLatLngs().length;
    const ld = g.sym.load.pg.getLatLngs().length, wheels = g.sym.carrier.pg.getLatLngs().length, cr = CranePickPlace.layers.get('u1').sym;
    return { cwMax: Math.max(...cw), up, boom, ld, wheels, crBoom: cr.boom.pl.getLatLngs().length, n: document.querySelectorAll('.crSym').length }; });
  near(m1.cwMax, 15, 0.01, 'counterweight corner on the 15 ft tail-swing radius'); assert.ok(m1.up >= 2 && m1.boom >= 1 && m1.ld === 1 && m1.wheels >= 8, JSON.stringify(m1)); assert.ok(m1.crBoom >= 3, 'lattice chords');
  await shot('accurate-map');
  // drag the pick point of Pick 1 round the crane: the upperworks turns with it (each frame)
  const u = c0, P0 = await p.evaluate(() => CranePickApp.P.picks[0].pick), a = await scr(P0);
  const cwAz = () => p.evaluate(() => { const g = CranePickPlace.layers.get('u0'), u = CranePickApp.P.setups[0], q = g.sym.cwt.pg.getLatLngs()[0][0].map(ll => CranePickMap.toFt(ll)), cx = q.reduce((s, v) => s + v.x, 0) / q.length, cy = q.reduce((s, v) => s + v.y, 0) / q.length;
    return (Math.atan2(cx - u.x, cy - u.y) * 180 / Math.PI + 360) % 360; });
  const az0 = await cwAz(); near(az0, 255, 0.5, 'counterweight opposite the boom (75 + 180)');
  const tgt = await scr({ x: u.x - 30, y: u.y }); await p.mouse.move(a.x, a.y); await p.mouse.down();
  const t0 = Date.now(), steps = 30; for (let i = 1; i <= steps; i++) await p.mouse.move(a.x + (tgt.x - a.x) * i / steps, a.y + (tgt.y - a.y) * i / steps);
  const dt = (Date.now() - t0) / steps; await p.waitForTimeout(80); const azD = await cwAz(); await p.mouse.up(); await p.waitForTimeout(300);
  const kp = await p.evaluate(() => CranePickApp.P.picks[0].pick), want = (Math.atan2(kp.x - u.x, kp.y - u.y) * 180 / Math.PI + 540) % 360;
  near(azD, want, 1, 'during the drag: counterweight opposite the dragged pick'); assert.ok(dt < 120, 'drag ' + dt.toFixed(1) + ' ms per move');
  await p.evaluate(() => CranePickMap.map.setZoom(15)); await p.waitForTimeout(400);
  const simple = await p.evaluate(() => CranePickPlace.layers.get('u1').sym.boom.pl.getLatLngs().reduce((a, l) => a + l.length, 0)); await p.evaluate(() => CranePickMap.map.setZoom(20)); await p.waitForTimeout(400);
  const full = await p.evaluate(() => CranePickPlace.layers.get('u1').sym.boom.pl.getLatLngs().reduce((a, l) => a + l.length, 0)); assert.ok(full > simple, `lacing at zoom 20 (${full}) not at zoom 15 (${simple})`);
  await p.evaluate(() => CranePickMap.fit([{ x: CranePickApp.P.setups[0].x - 60, y: CranePickApp.P.setups[0].y - 60 }, { x: CranePickApp.P.setups[0].x + 190, y: CranePickApp.P.setups[0].y + 80 }])); await p.waitForTimeout(500);
  await shot('accurate-map-dragged');
  ok(`map symbol: upperworks, counterweight on R_t = 15 ft (${m1.cwMax.toFixed(3)}), boom, hook, load, wheels; crawler lattice chords; the upperworks follows the dragged pick (${dt.toFixed(1)} ms per mouse move); simple detail at small zoom`);

  // 2. Drawings: aerial sheets
  await p.click('#tabBar [data-otab=dwg]'); await p.waitForSelector('#dwgIdx');
  const ids = await p.$$eval('#dwg_sheet option', o => o.map(x => x.value)); assert.deepEqual(ids.filter(i => /^aerial/.test(i)), ['aerial', 'aerial-k1', 'aerial-k2']);
  await p.selectOption('#dwg_sheet', 'aerial'); await p.waitForFunction(() => document.querySelector('.dwg-box svg image.crAerialImg'), null, { timeout: 30000 });
  const sv = await p.evaluate(() => { const s = document.querySelector('.dwg-box svg'), im = s.querySelector('image.crAerialImg'); return { href: im.getAttribute('href').slice(0, 22), t: s.textContent, note: document.getElementById('dwg_aerNote').textContent }; });
  assert.equal(sv.href, 'data:image/png;base64,'); assert.match(sv.t, /ESRI WORLD IMAGERY\. TILES \(C\) ESRI - SOURCE: ESRI, MAXAR/); assert.match(sv.t, /IMAGERY DATE VARIES; NOT A SURVEY/); assert.match(sv.note, /Zoom \d+, (\d+) of \1 tiles/);
  await shot('accurate-aerial-sheet');
  const dl = await p.evaluate(() => { const A = CranePickAerial, got = []; const s0 = A.save, t0 = A.saveText; A.save = (h, nm) => got.push([nm, h.slice(0, 22)]); A.saveText = (t, nm) => got.push([nm, t]);
    document.getElementById('dwg_aerPng').click(); document.getElementById('dwg_aerGrid').click(); A.save = s0; A.saveText = t0;
    const B = CranePickDrawingsUI.last, s = B.sheets.find(x => x.id === 'aerial'), f = A.frameOf(s.aerial.e), st = A.request(s.aerial.w, CranePickApp.P.site.zone, s.k);
    return { got, f, w: s.aerial.w, wpx: st.wpx, hpx: st.hpx }; });
  assert.deepEqual(dl.got.map(g => g[0]), ['AERIAL_SMOKE_aerial.png', 'AERIAL_SMOKE_aerial.pgw', 'AERIAL_SMOKE_aerial_stateplane.pgw']); assert.equal(dl.got[0][1], 'data:image/png;base64,');
  const pg = dl.got[1][1].trim().split('\n').map(Number), px = (dl.f.X1 - dl.f.X0) / dl.wpx;
  near(pg[0], px, 1e-6, 'A = frame width / image px'); assert.equal(pg[1], 0); assert.equal(pg[2], 0); near(pg[3], -px, 1e-6); near(pg[4], dl.f.X0 + px / 2, 1e-6, 'C: upper-left pixel centre'); near(pg[5], dl.f.Y1 - px / 2, 1e-6, 'F');
  near(px * dl.hpx, dl.f.Y1 - dl.f.Y0, px, 'image height = frame height');
  const gw = dl.got[2][1].trim().split('\n').map(Number), s = (dl.w.x1 - dl.w.x0) / dl.wpx; near(gw[0], s, 1e-9); near(gw[4], dl.w.x0 + s / 2, 1e-6, 'State Plane C (ftUS zone)'); near(gw[5], dl.w.y1 - s / 2, 1e-6);
  const dx = await p.evaluate(() => { const d0 = SharedDxf.download; SharedDxf.download = () => {}; document.getElementById('dwg_dxf').click(); SharedDxf.download = d0; const c = CranePickDrawingsUI.lastDxf.check; return { ok: c.ok, errs: c.errors, layers: c.layers }; });
  assert.ok(dx.ok, dx.errs.join('; ')); ['C-CRANE-CARRIER', 'C-CRANE-OUTRIGGER', 'C-CRANE-FLOAT', 'C-CRANE-UPPER', 'C-CRANE-CWT', 'C-CRANE-BOOM', 'C-CRANE-HOOK', 'C-CRANE-LOAD'].forEach(l => assert.ok(dx.layers.includes(l), l));
  const pr = await p.evaluate(async () => { let pages = [], img = 0; window.print = () => { pages.push(document.querySelectorAll('#sdx-print .sdx-sheet').length); img += document.querySelectorAll('#sdx-print image.crAerialImg').length; };
    document.getElementById('dwg_print1').click(); if (CranePickDrawingsUI.printing) await CranePickDrawingsUI.printing; window.dispatchEvent(new Event('afterprint')); return { pages, img }; });
  assert.deepEqual(pr, { pages: [1], img: 1 });
  await p.selectOption('#dwg_sheet', 'lift-k1'); await p.waitForTimeout(200); await shot('accurate-dwg-lift');
  assert.match(await p.$eval('.dwg-box svg', x => x.textContent), /HEADING 30 DEG[\s\S]*SLEW -\d+ DEG FROM FRONT, R 30\.\d FT/);
  await p.selectOption('#dwg_sheet', 'aerial-k2'); await p.waitForFunction(() => document.querySelector('.dwg-box svg image.crAerialImg'), null, { timeout: 30000 }); await shot('accurate-aerial-crawler');
  ok(`Drawings: aerial sheets (site + per lift) with the imagery under the plan and the attribution; PNG + .pgw (A ${pg[0].toFixed(4)}, C ${pg[4].toFixed(2)}, F ${pg[5].toFixed(2)} = the sheet frame in the DXF) + State Plane .pgw; DXF valid with the CRANE-* layers; print with the image; lift plan slew label`);

  // 3. offline
  const nErr = errs.length; offline = true;
  await p.evaluate(() => { CranePickAerial.clear(); CranePickAerial.url = CranePickAerial.ESRI + '?offline'; CranePickDrawingsUI.redraw(); }); await p.selectOption('#dwg_sheet', 'aerial');
  await p.waitForFunction(() => /AERIAL NOT AVAILABLE - PRINTED WITHOUT BACKGROUND/.test(document.querySelector('.dwg-box svg').textContent), null, { timeout: 40000 });
  assert.ok(!(await p.$('.dwg-box svg image.crAerialImg'))); assert.ok(await p.$eval('#dwg_aerPng', x => x.disabled));
  const pr2 = await p.evaluate(async () => { let pages = []; window.print = () => { pages.push(document.querySelectorAll('#sdx-print .sdx-sheet').length); }; document.getElementById('dwg_print1').click(); if (CranePickDrawingsUI.printing) await CranePickDrawingsUI.printing; window.dispatchEvent(new Event('afterprint')); return pages; });
  assert.deepEqual(pr2, [1]); await shot('accurate-aerial-offline');
  errs.splice(nErr, errs.length - nErr, ...errs.slice(nErr).filter(e => !/ERR_FAILED|Failed to load resource/.test(e)));   // the refused tiles
  offline = false; await p.evaluate(() => { CranePickAerial.clear(); CranePickAerial.url = CranePickAerial.ESRI + '?online'; });
  ok('offline: "AERIAL NOT AVAILABLE - PRINTED WITHOUT BACKGROUND" on the sheet, download disabled, the sheet still prints');

  // 4. Print plan view (Plan tab) and the Report figure
  await p.click('#tabBar [data-otab=plan]'); await p.waitForTimeout(400);
  const pv = await p.evaluate(async () => { let pages = [], img = 0; window.print = () => { pages.push(document.querySelectorAll('#sdx-print .sdx-sheet').length); img += document.querySelectorAll('#sdx-print image.crAerialImg').length; };
    document.getElementById('crPrintView').click(); if (CranePickDrawingsUI.printing) await CranePickDrawingsUI.printing; window.dispatchEvent(new Event('afterprint')); return { pages, img, t: CranePickDrawingsUI.lastView && CranePickDrawingsUI.lastView.a.status }; });
  assert.deepEqual(pv, { pages: [1], img: 1, t: 'ok' });
  await p.click('#tabBar [data-otab=rpt]'); await p.waitForFunction(() => { const h = document.getElementById('rptHost'); return h && /Site plan on the aerial background/.test(h.textContent) && h.querySelector('image.crAerialImg'); }, null, { timeout: 30000 });
  const rt = await p.evaluate(() => SharedReport.text(SharedReport.build(CranePickReport.model(CranePickApp.P))));
  assert.match(rt, /Imagery date varies by area[^\n]*not a survey/i); assert.match(rt, /Crane symbol on the plans/);
  await p.evaluate(() => { const h = [...document.querySelectorAll('#rptHost h2, #rptHost h3')].find(x => /Site plan/.test(x.textContent)); if (h) h.scrollIntoView(); }); await p.waitForTimeout(200); await shot('accurate-report');
  ok('Plan tab "Print plan view": one sheet with the image; Report §Site plan (aerial) figure with the imagery, the date / not-survey note, the crane-symbol assumptions');

  // 5. 390 px
  await p.setViewportSize({ width: 390, height: 800 }); await p.click('#tabBar [data-otab=plan]'); await p.waitForTimeout(400); await shot('accurate-390-map');
  await p.click('#tabBar [data-otab=dwg]'); await p.waitForTimeout(500);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1); await shot('accurate-390-dwg');
  assert.deepEqual(errs, []);
  ok(`390 px without page-wide horizontal scroll; 0 console errors (${tileHits} tile requests mocked)`);
  console.log(`crane-aerial: ${n} checks passed`);
} catch (e) { console.error(e); console.error('console errors:', errs); process.exitCode = 1; } finally { await b.close(); }
